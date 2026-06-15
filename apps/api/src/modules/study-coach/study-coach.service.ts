import { Injectable, Logger, NotFoundException, ConflictException } from '@nestjs/common';
import { db, studentProfiles, studyPlans, studyTasks, users, subjects, studentRelations, eq, and, sql } from '@studyai/database';
import { CreatePlanDto } from './dto/create-plan.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { RequestRelationDto } from './dto/request-relation.dto';
import { GamificationService } from './gamification.service';
import { AiService } from '../ai/ai.service';
import { Cron, CronExpression } from '@nestjs/schedule';

@Injectable()
export class StudyCoachService {
  private readonly logger = new Logger(StudyCoachService.name);

  constructor(
    private readonly gamificationService: GamificationService,
    private readonly aiService: AiService,
  ) {}

  // 1. Student Profile
  async getStudentProfile(userId: string) {
    let profile = await db
      .select()
      .from(studentProfiles)
      .where(eq(studentProfiles.userId, userId))
      .limit(1);

    if (profile.length === 0) {
      const created = await db
        .insert(studentProfiles)
        .values({
          userId,
          currentLevel: 1,
          xp: 0,
          dailyStudyGoalMinutes: 30,
          weeklyAvailableHours: 10,
          strengths: [],
          weaknesses: [],
        })
        .returning();
      return created[0];
    }
    return profile[0];
  }

  async updateStudentProfile(userId: string, dto: UpdateProfileDto) {
    await this.getStudentProfile(userId);

    const updated = await db
      .update(studentProfiles)
      .set({
        ...dto,
        updatedAt: new Date(),
      })
      .where(eq(studentProfiles.userId, userId))
      .returning();

    return updated[0];
  }

  // 2. Study Plans & AI Scheduler
  async getStudyPlans(userId: string) {
    return db
      .select()
      .from(studyPlans)
      .where(eq(studyPlans.userId, userId));
  }

  async createStudyPlan(userId: string, dto: CreatePlanDto) {
    const profile = await this.getStudentProfile(userId);

    const planResult = await db
      .insert(studyPlans)
      .values({
        userId,
        title: dto.title,
        startDate: dto.startDate,
        endDate: dto.endDate,
        isActive: true,
      })
      .returning();

    const plan = planResult[0];

    let subjectList = [];
    if (dto.subjects && dto.subjects.length > 0) {
      subjectList = await db
        .select()
        .from(subjects)
        .where(
          and(
            eq(subjects.userId, userId),
            sql`id IN ${dto.subjects}`
          )
        );
    } else {
      subjectList = await db
        .select()
        .from(subjects)
        .where(eq(subjects.userId, userId));
    }

    if (subjectList.length === 0) {
      return { plan, tasksCreated: 0 };
    }

    const start = new Date(dto.startDate);
    const end = new Date(dto.endDate);
    const daysDiff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;

    const subjectNames = subjectList.map((s) => s.name).join(', ');
    const systemPrompt = `You are an expert Study Coach. Generate a list of study topics for a student preparing for exams.
Return the result as a raw JSON array of objects, each representing a study topic. Each object must have:
- title: A specific study topic/title.
- description: A brief tutor-style instruction on what to study.
- durationMinutes: Recommended study duration (an integer e.g., 30, 45, 60).
- subjectName: The name of the subject this topic belongs to.

Format output strictly as a JSON array. Do not wrap in markdown or any other tags.
Example output:
[
  { "title": "Introduction to Limits", "description": "Review the concept of function limits and graphical representation.", "durationMinutes": 45, "subjectName": "Math" }
]`;

    const userPrompt = `Generate a customized study plan with exactly ${Math.min(daysDiff * 2, 20)} study topics for the following subjects: [${subjectNames}].
Adjust topic focus assuming the student has level ${profile.currentLevel} and available weekly time of ${profile.weeklyAvailableHours} hours.`;

    let generatedTopics = [];
    try {
      const completionText = await this.aiService.getCompletion(userPrompt, systemPrompt, true);
      generatedTopics = JSON.parse(completionText || '[]');
    } catch (e) {
      this.logger.warn('AI topic generation failed, falling back to static generation:', e);
      generatedTopics = subjectList.map((sub) => ({
        title: `Core review: ${sub.name}`,
        description: `Review fundamental resources and lessons for ${sub.name}.`,
        durationMinutes: 45,
        subjectName: sub.name,
      }));
    }

    const tasksToInsert = [];
    const currentDate = new Date(start);

    for (let i = 0; i < generatedTopics.length; i++) {
      const topic = generatedTopics[i];
      const matchingSubject = subjectList.find(
        (s) => s.name.toLowerCase() === topic.subjectName?.toLowerCase()
      ) || subjectList[0];

      if (!matchingSubject) continue;

      if (i > 0 && i % 2 === 0) {
        currentDate.setDate(currentDate.getDate() + 1);
        if (currentDate > end) {
          currentDate.setTime(start.getTime());
        }
      }

      tasksToInsert.push({
        planId: plan.id,
        userId,
        subjectId: matchingSubject.id,
        title: topic.title || `Review: ${matchingSubject.name}`,
        description: topic.description || 'General study review task.',
        date: currentDate.toISOString().split('T')[0],
        scheduledStart: '16:00:00',
        durationMinutes: topic.durationMinutes || 45,
        status: 'pending' as const,
        isAutoGenerated: true,
      });
    }

    if (tasksToInsert.length > 0) {
      await db.insert(studyTasks).values(tasksToInsert);
    }

    return {
      plan,
      tasksCreated: tasksToInsert.length,
    };
  }

  // 3. Study Tasks
  async getTasks(userId: string, dateStr?: string) {
    if (dateStr) {
      return db
        .select()
        .from(studyTasks)
        .where(
          and(
            eq(studyTasks.userId, userId),
            eq(studyTasks.date, dateStr)
          )
        );
    }
    return db
      .select()
      .from(studyTasks)
      .where(eq(studyTasks.userId, userId));
  }

  async updateTaskStatus(userId: string, taskId: string, dto: UpdateTaskDto) {
    const taskResult = await db
      .select()
      .from(studyTasks)
      .where(
        and(
          eq(studyTasks.id, taskId),
          eq(studyTasks.userId, userId)
        )
      )
      .limit(1);

    if (taskResult.length === 0) {
      throw new NotFoundException('Study task not found');
    }

    const task = taskResult[0];

    const updated = await db
      .update(studyTasks)
      .set({
        status: dto.status,
        scoreReceived: dto.scoreReceived || null,
        completedAt: dto.status === 'completed' ? new Date() : null,
        updatedAt: new Date(),
      })
      .where(eq(studyTasks.id, taskId))
      .returning();

    if (dto.status === 'completed' && task.status !== 'completed') {
      const baseTaskXp = 15;
      const bonusXp = dto.scoreReceived ? Math.floor(dto.scoreReceived / 10) : 0;
      const totalReward = baseTaskXp + bonusXp;

      const gamificationResult = await this.gamificationService.addXp(userId, totalReward);
      await this.gamificationService.updateChallengeProgress(userId, 'daily', task.durationMinutes);
      await this.gamificationService.updateChallengeProgress(userId, 'weekly', task.durationMinutes);

      return {
        task: updated[0],
        xpRewarded: totalReward,
        levelUpInfo: gamificationResult,
      };
    }

    return { task: updated[0] };
  }

  // 4. Auto-Rescheduling Incomplete Tasks (Runs daily at midnight)
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async rescheduleIncompleteTasks() {
    this.logger.log('Running auto-rescheduling for incomplete study tasks...');

    const todayStr = new Date().toISOString().split('T')[0];

    const incompleteTasks = await db
      .select()
      .from(studyTasks)
      .where(
        and(
          eq(studyTasks.status, 'pending'),
          sql`${studyTasks.date} < ${todayStr}`
        )
      );

    if (incompleteTasks.length === 0) {
      this.logger.log('No incomplete tasks found to reschedule.');
      return;
    }

    this.logger.log(`Found ${incompleteTasks.length} incomplete tasks. Rescheduling to tomorrow...`);

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];

    for (const task of incompleteTasks) {
      await db
        .update(studyTasks)
        .set({
          status: 'rescheduled',
          updatedAt: new Date(),
        })
        .where(eq(studyTasks.id, task.id));

      await db.insert(studyTasks).values({
        planId: task.planId,
        userId: task.userId,
        subjectId: task.subjectId,
        title: `[Rescheduled] ${task.title}`,
        description: task.description,
        date: tomorrowStr,
        scheduledStart: task.scheduledStart,
        durationMinutes: task.durationMinutes,
        status: 'pending',
        isAutoGenerated: true,
      });
    }

    this.logger.log('Rescheduling completed successfully.');
  }

  // 5. Parent & Teacher Relations Portal
  async requestRelation(studentId: string, dto: RequestRelationDto) {
    const guardianResult = await db
      .select()
      .from(users)
      .where(eq(users.email, dto.email))
      .limit(1);

    if (guardianResult.length === 0) {
      throw new NotFoundException('Guardian email not found');
    }

    const guardian = guardianResult[0];

    const existing = await db
      .select()
      .from(studentRelations)
      .where(
        and(
          eq(studentRelations.studentId, studentId),
          eq(studentRelations.guardianId, guardian.id)
        )
      )
      .limit(1);

    if (existing.length > 0) {
      throw new ConflictException('Relationship request already exists');
    }

    const created = await db
      .insert(studentRelations)
      .values({
        studentId,
        guardianId: guardian.id,
        relationType: dto.relationType,
        isApproved: false,
      })
      .returning();

    return created[0];
  }

  async getGuardianRelations(guardianId: string) {
    return db
      .select({
        relationId: studentRelations.id,
        relationType: studentRelations.relationType,
        isApproved: studentRelations.isApproved,
        student: {
          id: users.id,
          email: users.email,
          firstName: users.firstName,
          lastName: users.lastName,
          avatarUrl: users.avatarUrl,
        },
      })
      .from(studentRelations)
      .innerJoin(users, eq(studentRelations.studentId, users.id))
      .where(eq(studentRelations.guardianId, guardianId));
  }

  async approveRelation(guardianId: string, relationId: string) {
    const relation = await db
      .select()
      .from(studentRelations)
      .where(
        and(
          eq(studentRelations.id, relationId),
          eq(studentRelations.guardianId, guardianId)
        )
      )
      .limit(1);

    if (relation.length === 0) {
      throw new NotFoundException('Relationship request not found');
    }

    const updated = await db
      .update(studentRelations)
      .set({
        isApproved: true,
      })
      .where(eq(studentRelations.id, relationId))
      .returning();

    return updated[0];
  }
}
