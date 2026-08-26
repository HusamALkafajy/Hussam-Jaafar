import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
  WsException,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger, UseGuards } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { StudyGroupsService } from './study-groups.service';
import { ConfigService } from '@nestjs/config';

/**
 * WebSocket Gateway for real-time Study Group chat.
 *
 * Socket.io Rooms are used to segregate group traffic:
 *   - Each group has a room named `group:{groupId}`
 *   - Clients join a room via the `joinGroup` event
 *   - Messages are emitted to the room via the `sendGroupMessage` event
 *   - Other clients in the room receive the `newGroupMessage` event
 */
@WebSocketGateway({
  /**
   * CORS must allow the Next.js dev server (port 3001 in this project).
   * We read FRONTEND_URL from the environment; fall back to localhost:3001.
   * An array is accepted so both ports work during development.
   * NOTE (Architecture Exemption): process.env is used here because decorators
   * execute at module load time before the DI container provides ConfigService.
   */
  cors: {
    origin: [
      process.env.FRONTEND_URL || 'http://localhost:3001',
      'http://localhost:3000', // keep as secondary fallback
      'http://localhost:3001',
    ],
    credentials: true,    // required so the browser sends cookies on the WS handshake
    methods: ['GET', 'POST'],
  },
  /**
   * Allow both transports so the Engine.IO handshake (HTTP polling) completes
   * before upgrading to WebSocket. Polling is needed for the cookie to reach
   * the server on the very first connection request.
   */
  transports: ['polling', 'websocket'],
  namespace: '/study-groups',
  addTrailingSlash: false,
})
export class StudyGroupsGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(StudyGroupsGateway.name);

  constructor(
    private readonly studyGroupsService: StudyGroupsService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  afterInit() {
    this.logger.log('StudyGroups WebSocket Gateway initialized');
  }

  // ── Connection lifecycle ─────────────────────────────────────────────────

  async handleConnection(client: Socket) {
    try {
      const userId = await this.extractUserId(client);
      // Attach userId to socket so we can reference it in message handlers
      client.data.userId = userId;
      this.logger.log(`Client connected: ${client.id} (user: ${userId})`);
    } catch {
      this.logger.warn(`Unauthenticated connection attempt: ${client.id} — disconnecting`);
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  // ── Events ───────────────────────────────────────────────────────────────

  /**
   * Client emits `joinGroup` with { groupId } to subscribe to a group room.
   * Membership is verified before the client is admitted.
   */
  @SubscribeMessage('joinGroup')
  async handleJoinGroup(
    @MessageBody() payload: { groupId: string },
    @ConnectedSocket() client: Socket,
  ) {
    const { groupId } = payload;
    const userId: string = client.data.userId;

    try {
      await this.studyGroupsService.assertMembership(groupId, userId);
    } catch {
      throw new WsException('You are not a member of this group.');
    }

    const room = `group:${groupId}`;
    await client.join(room);
    this.logger.log(`User ${userId} joined room ${room}`);

    client.emit('joinedGroup', { groupId, room });
  }

  /**
   * Client emits `sendGroupMessage` with { groupId, content }.
   * Message is persisted to DB and then broadcast to all room members.
   */
  @SubscribeMessage('sendGroupMessage')
  async handleSendMessage(
    @MessageBody() payload: { groupId: string; content: string },
    @ConnectedSocket() client: Socket,
  ) {
    const { groupId, content } = payload;
    const senderId: string = client.data.userId;

    if (!content?.trim()) {
      throw new WsException('Message content cannot be empty.');
    }

    // Verify membership (re-check for security on every message)
    try {
      await this.studyGroupsService.assertMembership(groupId, senderId);
    } catch {
      throw new WsException('You are not a member of this group.');
    }

    // Persist to DB
    const message = await this.studyGroupsService.persistMessage(groupId, senderId, content.trim());

    // Broadcast to all sockets in the room (including sender for confirmation)
    this.server.to(`group:${groupId}`).emit('newGroupMessage', {
      ...message,
      senderId,
    });

    return { success: true, messageId: message.id };
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  /**
   * Extract and verify the JWT from (in priority order):
   *   1. `access_token` httpOnly cookie  ← primary path (browser client)
   *   2. `Authorization: Bearer <token>` header
   *   3. `auth.token` handshake auth payload  ← useful for non-browser clients
   *
   * The httpOnly cookie path is first because socket.io-client sends cookies
   * automatically when `withCredentials: true` is set, and the JWT is stored
   * as an httpOnly cookie by the NestJS auth flow.
   */
  private async extractUserId(client: Socket): Promise<string> {
    // 1. Parse cookies from the handshake headers
    const cookieHeader = client.handshake.headers.cookie || '';
    const cookieToken = this.parseCookie(cookieHeader, 'access_token');

    // 2. Authorization header bearer token
    const authHeader = client.handshake.headers.authorization as string | undefined;
    const headerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined;

    // 3. Explicit auth payload (e.g., Postman / mobile clients)
    const authPayload = client.handshake.auth?.token as string | undefined;

    const raw = cookieToken || headerToken || authPayload;

    if (!raw) {
      this.logger.warn(`[WS] No token found for socket ${client.id}. Cookie: ${cookieHeader ? 'present' : 'absent'}`);
      throw new Error('No authentication token provided');
    }

    if (authPayload && raw === authPayload) {
      this.logger.log(`[WS] Token resolved from auth payload for socket ${client.id}`);
    } else if (cookieToken && raw === cookieToken) {
      this.logger.log(`[WS] Token resolved from cookie for socket ${client.id}`);
    } else if (headerToken && raw === headerToken) {
      this.logger.log(`[WS] Token resolved from header for socket ${client.id}`);
    }

    try {
      const secret = this.configService.getOrThrow<string>('auth.jwtSecret');
      const payload = this.jwtService.verify(raw, { secret });
      if (!payload?.sub) throw new Error('JWT payload missing sub claim');
      return payload.sub as string;
    } catch (err: any) {
      this.logger.warn(`[WS] JWT verification failed for socket ${client.id}: ${err.message}`);
      throw new Error('Invalid or expired token');
    }
  }

  /** Minimal cookie string parser — extracts a single named cookie value. */
  private parseCookie(cookieStr: string, name: string): string | undefined {
    const match = cookieStr.match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`));
    return match ? decodeURIComponent(match[1]) : undefined;
  }
}
