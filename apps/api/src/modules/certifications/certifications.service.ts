import { Injectable, NotFoundException } from '@nestjs/common';
import { db, certifications, users, learningPaths, eq, and } from '@studyai/database';
import * as crypto from 'crypto';

@Injectable()
export class CertificationsService {
  async issueCertificate(userId: string, pathId: string) {
    // Check if certificate already exists
    const existing = await db
      .select()
      .from(certifications)
      .where(and(eq(certifications.userId, userId), eq(certifications.pathId, pathId)))
      .limit(1);

    if (existing.length > 0) {
      return existing[0];
    }

    const timestamp = Date.now().toString();
    const secret = 'studyai-certification-salt';
    const hashInput = `${userId}-${pathId}-${timestamp}-${secret}`;
    const certificateHash = crypto.createHash('sha256').update(hashInput).digest('hex');
    const verificationUrl = `/certifications/verify/${certificateHash}`;

    const [record] = await db
      .insert(certifications)
      .values({
        userId,
        pathId,
        certificateHash,
        verificationUrl,
      })
      .returning();

    return record;
  }

  async verifyCertificate(hash: string) {
    const records = await db
      .select({
        id: certifications.id,
        certificateHash: certifications.certificateHash,
        issuedAt: certifications.issuedAt,
        verificationUrl: certifications.verificationUrl,
        user: {
          firstName: users.firstName,
          lastName: users.lastName,
          email: users.email,
        },
        path: {
          skillName: learningPaths.skillName,
          difficultyLevel: learningPaths.difficultyLevel,
        },
      })
      .from(certifications)
      .innerJoin(users, eq(certifications.userId, users.id))
      .innerJoin(learningPaths, eq(certifications.pathId, learningPaths.id))
      .where(eq(certifications.certificateHash, hash))
      .limit(1);

    if (records.length === 0) {
      throw new NotFoundException('Certification not found or invalid');
    }

    return {
      isValid: true,
      recipientName: `${records[0].user.firstName} ${records[0].user.lastName}`,
      skillName: records[0].path.skillName,
      difficultyLevel: records[0].path.difficultyLevel,
      issuedAt: records[0].issuedAt,
      certificateHash: records[0].certificateHash,
    };
  }

  async getUserCertificates(userId: string) {
    return db
      .select({
        id: certifications.id,
        certificateHash: certifications.certificateHash,
        issuedAt: certifications.issuedAt,
        verificationUrl: certifications.verificationUrl,
        path: {
          skillName: learningPaths.skillName,
          difficultyLevel: learningPaths.difficultyLevel,
        },
      })
      .from(certifications)
      .innerJoin(learningPaths, eq(certifications.pathId, learningPaths.id))
      .where(eq(certifications.userId, userId));
  }
}
