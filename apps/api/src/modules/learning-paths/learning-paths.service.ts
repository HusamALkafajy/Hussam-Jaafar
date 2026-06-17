import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import {
  db,
  learningPaths, learningStages, lessons, projects, certifications, knowledgeGaps, aiTokenUsage,
  exams, flashcardSets,
  eq, and, asc, sql, desc,
} from '@studyai/database';
import { CreatePathDto } from './dto/create-path.dto';
import { AiService } from '../ai/ai.service';
import { GamificationService } from '../study-coach/gamification.service';
import * as crypto from 'crypto';

@Injectable()
export class LearningPathsService {
  private readonly logger = new Logger(LearningPathsService.name);

  constructor(
    private readonly aiService: AiService,
    private readonly gamificationService: GamificationService,
  ) {}

  async createPath(userId: string, dto: CreatePathDto) {
    this.logger.log(`Generating learning path for user ${userId}: ${dto.skillName} (${dto.difficultyLevel})`);

    const systemPrompt = `You are the Learning Path Agent, a principal curriculum architect. 
Generate a personalized, structured learning roadmap to teach the skill: "${dto.skillName}" for a "${dto.difficultyLevel}" level student, with the end goal: "${dto.endGoal}".
The user can study for ${dto.dailyAvailableMinutes || 30} minutes per day.

You must output a JSON object with this exact structure:
{
  "stages": [
    {
      "title": "Stage Title",
      "description": "Stage Description",
      "estimatedHours": 5,
      "lessons": [
        {
          "title": "Lesson Title",
          "content": "Deep, comprehensive explanation in Markdown. Explain concepts clearly and include examples."
        }
      ],
      "project": {
        "title": "Project Title",
        "description": "Hands-on project description detailing what the student must build and submit.",
        "starterCode": "Optional starter code or template."
      }
    }
  ]
}

Ensure the response is a single, valid JSON object. Do not include any explanation outside the JSON. Make the lesson content detailed and high-quality.`;

    const userPrompt = `Create a learning path for:
Skill: ${dto.skillName}
Difficulty: ${dto.difficultyLevel}
End Goal: ${dto.endGoal}
Daily Available Minutes: ${dto.dailyAvailableMinutes || 30}`;

    let responseJsonStr: string;
    try {
      responseJsonStr = await this.aiService.getCompletion(userPrompt, systemPrompt, true);
    } catch (err: any) {
      this.logger.error('Failed to get learning path completion from AI service', err);
      throw new BadRequestException(`AI Roadmap Generation failed: ${err.message}`);
    }

    let parsedRoadmap: any;
    try {
      // Clean JSON if it contains markdown code blocks
      const cleanJsonStr = this.cleanJson(responseJsonStr);
      parsedRoadmap = JSON.parse(cleanJsonStr);
    } catch (err: any) {
      this.logger.error('Failed to parse AI response as JSON. Response was: ' + responseJsonStr, err);
      throw new BadRequestException('AI generated an invalid JSON roadmap structure');
    }

    if (!parsedRoadmap.stages || !Array.isArray(parsedRoadmap.stages) || parsedRoadmap.stages.length === 0) {
      throw new BadRequestException('AI response did not contain a valid stages array');
    }

    // Estimate token usage and log
    const promptLen = systemPrompt.length + userPrompt.length;
    const completionLen = responseJsonStr.length;
    const promptTokens = Math.round(promptLen / 4);
    const completionTokens = Math.round(completionLen / 4);
    const costUSD = (promptTokens * 0.00015 + completionTokens * 0.0006) / 1000;

    try {
      await db.insert(aiTokenUsage).values({
        userId,
        agentType: 'learning_path_agent',
        model: 'default',
        promptTokens,
        completionTokens,
        costUSD: costUSD.toFixed(6) as any,
      });
    } catch (e) {
      this.logger.error('Failed to log token usage', e);
    }

    // Transaction to save path, stages, lessons, and projects
    const result = await db.transaction(async (tx) => {
      // 1. Create Learning Path
      const [pathRecord] = await tx.insert(learningPaths).values({
        userId,
        skillName: dto.skillName,
        difficultyLevel: dto.difficultyLevel,
        endGoal: dto.endGoal,
        dailyAvailableMinutes: dto.dailyAvailableMinutes || 30,
        isCompleted: false,
      }).returning();

      // 2. Create Stages, Lessons, and Projects
      for (let i = 0; i < parsedRoadmap.stages.length; i++) {
        const stage = parsedRoadmap.stages[i];
        
        const [stageRecord] = await tx.insert(learningStages).values({
          pathId: pathRecord.id,
          title: stage.title,
          description: stage.description,
          orderIndex: i,
          status: i === 0 ? 'active' : 'locked', // First stage is active, others locked
          estimatedHours: stage.estimatedHours || 5,
        }).returning();

        // Add Lessons
        if (stage.lessons && Array.isArray(stage.lessons)) {
          for (const lesson of stage.lessons) {
            await tx.insert(lessons).values({
              stageId: stageRecord.id,
              title: lesson.title,
              content: lesson.content,
              isCompleted: false,
            });
          }
        }

        // Add Stage Project
        if (stage.project) {
          await tx.insert(projects).values({
            stageId: stageRecord.id,
            userId,
            title: stage.project.title,
            description: stage.project.description,
            starterCode: stage.project.starterCode || null,
            status: 'pending',
          });
        }
      }

      return pathRecord;
    });

    return result;
  }

  async getPaths(userId: string) {
    return db
      .select()
      .from(learningPaths)
      .where(eq(learningPaths.userId, userId))
      .orderBy(sql`${learningPaths.createdAt} DESC`);
  }

  async getPathDetail(pathId: string, userId: string) {
    const paths = await db
      .select()
      .from(learningPaths)
      .where(and(eq(learningPaths.id, pathId), eq(learningPaths.userId, userId)))
      .limit(1);

    if (paths.length === 0) {
      throw new NotFoundException('Learning path not found');
    }

    const pathRecord = paths[0];

    const stages = await db
      .select()
      .from(learningStages)
      .where(eq(learningStages.pathId, pathId))
      .orderBy(asc(learningStages.orderIndex));

    const stagesWithDetails = [];

    for (const stage of stages) {
      const stageLessons = await db
        .select()
        .from(lessons)
        .where(eq(lessons.stageId, stage.id));

      const stageProjects = await db
        .select()
        .from(projects)
        .where(and(eq(projects.stageId, stage.id), eq(projects.userId, userId)));

      const stageGaps = await db
        .select()
        .from(knowledgeGaps)
        .where(and(eq(knowledgeGaps.stageId, stage.id), eq(knowledgeGaps.userId, userId)));

      stagesWithDetails.push({
        ...stage,
        lessons: stageLessons,
        project: stageProjects[0] || null,
        gaps: stageGaps,
      });
    }

    return {
      ...pathRecord,
      stages: stagesWithDetails,
    };
  }

  async completeLesson(lessonId: string, userId: string) {
    // 1. Verify lesson belongs to user path
    const lessonResult = await db
      .select({
        lessonId: lessons.id,
        stageId: lessons.stageId,
        pathId: learningStages.pathId,
        userId: learningPaths.userId,
      })
      .from(lessons)
      .innerJoin(learningStages, eq(lessons.stageId, learningStages.id))
      .innerJoin(learningPaths, eq(learningStages.pathId, learningPaths.id))
      .where(and(eq(lessons.id, lessonId), eq(learningPaths.userId, userId)))
      .limit(1);

    if (lessonResult.length === 0) {
      throw new NotFoundException('Lesson not found or access denied');
    }

    // 2. Mark lesson as completed
    const [updatedLesson] = await db
      .update(lessons)
      .set({ isCompleted: true })
      .where(eq(lessons.id, lessonId))
      .returning();

    // Award XP
    const xpResult = await this.gamificationService.addXp(userId, 25);

    // Check if first lesson completed and award badge
    let firstLessonBadgeResult = null;
    try {
      const awardRes = await this.gamificationService.awardBadgeByCode(userId, 'first_lesson');
      if (awardRes.success) {
        firstLessonBadgeResult = awardRes.badge;
      }
    } catch (e) {
      this.logger.error('Failed to award first lesson badge', e);
    }

    // 3. Auto-unlock project if all lessons in the stage are completed
    // We can return details to the client
    return {
      success: true,
      lesson: updatedLesson,
      ...xpResult,
      awardedBadge: firstLessonBadgeResult,
    };
  }

  // ── Path-level update (PATCH /learning-paths/:id) ────────────────────────

  /**
   * Update mutable top-level fields on a learning path.
   * Currently supports: isAdaptive
   */
  async updatePath(pathId: string, userId: string, body: { isAdaptive?: boolean }) {
    const pathResult = await db
      .select({ id: learningPaths.id, userId: learningPaths.userId })
      .from(learningPaths)
      .where(and(eq(learningPaths.id, pathId), eq(learningPaths.userId, userId)))
      .limit(1);

    if (pathResult.length === 0) {
      throw new NotFoundException('Learning path not found.');
    }

    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (typeof body.isAdaptive === 'boolean') {
      updates.isAdaptive = body.isAdaptive;
    }

    const [updated] = await db
      .update(learningPaths)
      .set(updates as any)
      .where(eq(learningPaths.id, pathId))
      .returning();

    this.logger.log(
      `[updatePath] pathId=${pathId} updated: ${JSON.stringify(updates)}`,
    );

    return updated;
  }

  // ── Adaptive Evaluation ───────────────────────────────────────────────────

  /**
   * Evaluate a single learning path and adapt it based on the user's
   * recent exam scores and flashcard mastery ratio.
   *
   * Scoring formula (0–100):
   *   performanceScore = (avgExamScore * 0.60) + (masteryRatio * 100 * 0.40)
   *
   * Result:
   *   score >= 70  → unlock next locked stage  (action: 'advanced')
   *   score < 70   → insert a knowledge gap    (action: 'gap_added')
   *   no locked stages / already completed     (action: 'no_change')
   */
  async evaluatePath(pathId: string, userId: string) {
    // ── 1. Verify ownership ───────────────────────────────────────────────
    const pathResult = await db
      .select()
      .from(learningPaths)
      .where(and(eq(learningPaths.id, pathId), eq(learningPaths.userId, userId)))
      .limit(1);

    if (pathResult.length === 0) {
      throw new NotFoundException('Learning path not found.');
    }
    const path = pathResult[0];

    if (path.isCompleted) {
      return { performanceScore: null, action: 'no_change', reason: 'Path is already completed.' };
    }

    // ── 2. Aggregate exam scores (last 30 days) ───────────────────────────
    const examRows = await db
      .select({ score: exams.score })
      .from(exams)
      .where(
        and(
          eq(exams.userId, userId),
          sql`${exams.completedAt} IS NOT NULL`,
          sql`${exams.completedAt} > NOW() - INTERVAL '30 days'`,
        ),
      );

    const avgExamScore: number =
      examRows.length > 0
        ? examRows.reduce((sum, r) => sum + parseFloat(r.score as unknown as string || '0'), 0) /
          examRows.length
        : 50; // Default neutral score if no exams taken

    // ── 3. Aggregate flashcard mastery ────────────────────────────────────
    const flashRows = await db
      .select({
        totalCards: flashcardSets.totalCards,
        masteredCount: flashcardSets.masteredCount,
      })
      .from(flashcardSets)
      .where(eq(flashcardSets.userId, userId));

    const totalCards = flashRows.reduce((s, r) => s + (r.totalCards ?? 0), 0);
    const masteredCards = flashRows.reduce((s, r) => s + (r.masteredCount ?? 0), 0);
    const masteryRatio = totalCards > 0 ? masteredCards / totalCards : 0.5; // Default 50% if no flashcards

    // ── 4. Compute weighted performance score ─────────────────────────────
    const performanceScore = Math.round(avgExamScore * 0.6 + masteryRatio * 100 * 0.4);

    this.logger.log(
      `[evaluatePath] pathId=${pathId} userId=${userId} ` +
      `avgExam=${avgExamScore.toFixed(1)} masteryRatio=${(masteryRatio * 100).toFixed(1)}% ` +
      `→ score=${performanceScore}`,
    );

    // ── 5. Determine adaptation action ────────────────────────────────────
    let action: 'advanced' | 'gap_added' | 'no_change' = 'no_change';
    let adaptationNotes: string;

    if (performanceScore >= 70) {
      // Find the first locked stage in this path
      const nextLockedStage = await db
        .select({ id: learningStages.id, title: learningStages.title })
        .from(learningStages)
        .where(and(eq(learningStages.pathId, pathId), eq(learningStages.status, 'locked')))
        .orderBy(asc(learningStages.orderIndex))
        .limit(1);

      if (nextLockedStage.length > 0) {
        await db
          .update(learningStages)
          .set({ status: 'active' })
          .where(eq(learningStages.id, nextLockedStage[0].id));

        action = 'advanced';
        adaptationNotes =
          `Strong performance (score ${performanceScore}/100). ` +
          `Unlocked stage: "${nextLockedStage[0].title}".`;

        this.logger.log(
          `[evaluatePath] Unlocked stage "${nextLockedStage[0].title}" for path ${pathId}`,
        );
      } else {
        // All stages unlocked — mark the path as completed
        await db
          .update(learningPaths)
          .set({ isCompleted: true })
          .where(eq(learningPaths.id, pathId));

        adaptationNotes = `All stages mastered. Path marked as completed (score ${performanceScore}/100).`;
        this.logger.log(`[evaluatePath] All stages unlocked — path ${pathId} marked complete`);
      }
    } else {
      // Insert a knowledge gap record pointing to the current active stage
      const activeStage = await db
        .select({ id: learningStages.id, title: learningStages.title })
        .from(learningStages)
        .where(and(eq(learningStages.pathId, pathId), eq(learningStages.status, 'active')))
        .orderBy(asc(learningStages.orderIndex))
        .limit(1);

      const stageId = activeStage.length > 0 ? activeStage[0].id : null;
      const stageTitle = activeStage.length > 0 ? activeStage[0].title : 'current stage';

      // Avoid duplicate open gaps for the same concept+stage
      const existingGap = await db
        .select({ id: knowledgeGaps.id })
        .from(knowledgeGaps)
        .where(
          and(
            eq(knowledgeGaps.userId, userId),
            stageId ? eq(knowledgeGaps.stageId, stageId) : sql`1=1`,
            eq(knowledgeGaps.isResolved, false),
            eq(knowledgeGaps.concept, 'Adaptive evaluation gap'),
          ),
        )
        .limit(1);

      if (existingGap.length === 0) {
        await db.insert(knowledgeGaps).values({
          userId,
          concept: 'Adaptive evaluation gap',
          stageId,
          severity: performanceScore < 40 ? 'high' : 'medium',
          remedialAction:
            `Your performance score is ${performanceScore}/100. ` +
            `Review the material in "${stageTitle}", redo weak flashcard sets, ` +
            `and re-take any failed exams before progressing.`,
          isResolved: false,
        });
      }

      action = 'gap_added';
      adaptationNotes =
        `Performance below threshold (score ${performanceScore}/100). ` +
        `A knowledge gap has been flagged in "${stageTitle}". ` +
        `Review required before advancing.`;

      this.logger.warn(
        `[evaluatePath] Below-threshold score ${performanceScore} for path ${pathId} — gap flagged`,
      );
    }

    // ── 6. Persist evaluation metadata to the path row ────────────────────
    await db
      .update(learningPaths)
      .set({
        lastEvaluatedAt: new Date(),
        adaptationScore: performanceScore,
        adaptationNotes,
        updatedAt: new Date(),
      })
      .where(eq(learningPaths.id, pathId));

    return {
      performanceScore,
      action,
      adaptationNotes,
      examsSampled: examRows.length,
      avgExamScore: Math.round(avgExamScore),
      masteryPercent: Math.round(masteryRatio * 100),
    };
  }

  /**
   * Nightly cron job — runs at 02:00 UTC every day.
   * Evaluates every active, adaptive learning path across all users.
   * Skips paths where `isAdaptive = false` (user has opted out).
   */
  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async evaluateAllActivePaths() {
    this.logger.log('[Cron:evaluateAllActivePaths] Starting nightly adaptive path evaluation...');

    const activePaths = await db
      .select({ id: learningPaths.id, userId: learningPaths.userId, skillName: learningPaths.skillName })
      .from(learningPaths)
      .where(
        and(
          eq(learningPaths.isCompleted, false),
          eq(learningPaths.isAdaptive, true),
        ),
      );

    this.logger.log(`[Cron:evaluateAllActivePaths] Found ${activePaths.length} active adaptive paths`);

    let advanced = 0;
    let gapsAdded = 0;
    let errors = 0;

    for (const path of activePaths) {
      try {
        const result = await this.evaluatePath(path.id, path.userId);
        if (result.action === 'advanced') advanced++;
        if (result.action === 'gap_added') gapsAdded++;
      } catch (err: any) {
        errors++;
        this.logger.error(
          `[Cron:evaluateAllActivePaths] Failed for path ${path.id} ("${path.skillName}"): ${err.message}`,
        );
      }
    }

    this.logger.log(
      `[Cron:evaluateAllActivePaths] Complete — ` +
      `advanced: ${advanced}, gaps added: ${gapsAdded}, errors: ${errors}`,
    );
  }

  private cleanJson(str: string): string {
    let clean = str.trim();
    
    // Strictly extract JSON object or array using regex
    const match = /(\{[\s\S]*\}|\[[\s\S]*\])/.exec(clean);
    if (match) {
      clean = match[0];
    }
    
    clean = clean.trim();
    // Fix invalid backslash escapes (e.g. \* or \_ generated by LLM markdown escaping)
    clean = clean.replace(/\\(?!["\\/bfnrt]|u[0-9a-fA-F]{4})/g, '\\\\');
    return clean;
  }
}
