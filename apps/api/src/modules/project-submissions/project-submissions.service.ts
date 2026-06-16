import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { db, projects, learningStages, learningPaths, knowledgeGaps, aiTokenUsage, eq, and, asc, sql } from '@studyai/database';
import { SubmitProjectDto } from './dto/submit-project.dto';
import { AiService } from '../ai/ai.service';
import { CertificationsService } from '../certifications/certifications.service';
import { GamificationService } from '../study-coach/gamification.service';

@Injectable()
export class ProjectSubmissionsService {
  private readonly logger = new Logger(ProjectSubmissionsService.name);

  constructor(
    private readonly aiService: AiService,
    private readonly certificationsService: CertificationsService,
    private readonly gamificationService: GamificationService,
  ) {}

  async submitProject(projectId: string, userId: string, dto: SubmitProjectDto) {
    this.logger.log(`Student ${userId} submitting project ${projectId}`);

    // 1. Fetch project and verify ownership
    const projectRecords = await db
      .select({
        id: projects.id,
        stageId: projects.stageId,
        title: projects.title,
        description: projects.description,
        starterCode: projects.starterCode,
        userId: projects.userId,
        pathId: learningStages.pathId,
        orderIndex: learningStages.orderIndex,
      })
      .from(projects)
      .innerJoin(learningStages, eq(projects.stageId, learningStages.id))
      .where(and(eq(projects.id, projectId), eq(projects.userId, userId)))
      .limit(1);

    if (projectRecords.length === 0) {
      throw new NotFoundException('Project not found or access denied');
    }

    const projectRecord = projectRecords[0];

    // 2. Update status to submitted
    await db
      .update(projects)
      .set({
        studentSubmission: dto.studentSubmission,
        status: 'submitted',
        updatedAt: new Date(),
      })
      .where(eq(projects.id, projectId));

    const systemPrompt = `You are the Exam Agent, an expert code reviewer and technical grader.
Evaluate the student's submission for the project: "${projectRecord.title}".
Project Requirements:
${projectRecord.description}

You must return a JSON response with the score (0 to 100), passing status (score >= 70), detailed markdown feedback, and any conceptual knowledge gaps detected.
Use this exact JSON format:
{
  "score": 85,
  "passed": true,
  "feedbackText": "Constructive markdown review...",
  "gaps": ["recursion", "asynchronous control flow"]
}

Respond ONLY with a valid JSON object. Do not include markdown formatting like \`\`\`json, and do not include any introductory or concluding text.`;

    const userPrompt = `Student Submission:
${dto.studentSubmission}`;

    let responseJsonStr: string;
    try {
      responseJsonStr = await this.aiService.getCompletion(userPrompt, systemPrompt, true);
    } catch (err: any) {
      this.logger.error(`AI project evaluation failed for project ${projectId}`, err);
      throw new BadRequestException(`AI evaluation failed: ${err.message}`);
    }

    let evaluation: any;
    try {
      evaluation = JSON.parse(this.cleanJson(responseJsonStr));
    } catch (err: any) {
      this.logger.error(`Failed to parse AI evaluation response: ${responseJsonStr}`, err);
      throw new BadRequestException('AI returned an invalid evaluation JSON structure');
    }

    const score = typeof evaluation.score === 'number' ? evaluation.score : 50;
    const passed = score >= 70;
    const feedbackText = evaluation.feedbackText || 'Project reviewed by AI.';
    const gaps: string[] = Array.isArray(evaluation.gaps) ? evaluation.gaps : [];

    // Estimate token usage and log
    const promptLen = systemPrompt.length + userPrompt.length;
    const completionLen = responseJsonStr.length;
    const promptTokens = Math.round(promptLen / 4);
    const completionTokens = Math.round(completionLen / 4);
    const costUSD = (promptTokens * 0.00015 + completionTokens * 0.0006) / 1000;

    try {
      await db.insert(aiTokenUsage).values({
        userId,
        agentType: 'exam_agent',
        model: 'default',
        promptTokens,
        completionTokens,
        costUSD: costUSD.toFixed(6) as any,
      });
    } catch (e) {
      this.logger.error('Failed to log token usage', e);
    }

    // Transaction to update project grading, stage unlocking, knowledge gaps, and certificate
    await db.transaction(async (tx) => {
      // Update project status, score and feedback
      await tx
        .update(projects)
        .set({
          score,
          feedbackText,
          status: 'graded',
          updatedAt: new Date(),
        })
        .where(eq(projects.id, projectId));

      // Handle knowledge gaps if score is < 70
      if (!passed) {
        for (const concept of gaps) {
          await tx.insert(knowledgeGaps).values({
            userId,
            concept,
            stageId: projectRecord.stageId,
            severity: 'high',
            remedialAction: `Review the stage material, specifically on ${concept}. Make sure to understand its core rules and practices.`,
            isResolved: false,
          });
        }
        
        // Dynamic adaptive tutoring response: we could append a custom remedial lesson to this stage if needed
        // For now, logging the gaps for student tracking is the core requirement.
      } else {
        // Resolve any existing gaps for this stage
        await tx
          .update(knowledgeGaps)
          .set({ isResolved: true, resolvedAt: new Date() })
          .where(and(eq(knowledgeGaps.stageId, projectRecord.stageId), eq(knowledgeGaps.userId, userId)));

        // Update stage status to completed
        await tx
          .update(learningStages)
          .set({ status: 'completed' })
          .where(eq(learningStages.id, projectRecord.stageId));

        // Unlock next stage (stages with orderIndex = currentOrderIndex + 1)
        const nextStages = await tx
          .select({ id: learningStages.id })
          .from(learningStages)
          .where(and(
            eq(learningStages.pathId, projectRecord.pathId),
            eq(learningStages.orderIndex, projectRecord.orderIndex + 1),
          ))
          .limit(1);

        if (nextStages.length > 0) {
          // Unlock next stage
          await tx
            .update(learningStages)
            .set({ status: 'active' })
            .where(eq(learningStages.id, nextStages[0].id));
        } else {
          // No next stage! Mark learning path as completed and issue certificate
          await tx
            .update(learningPaths)
            .set({ isCompleted: true, updatedAt: new Date() })
            .where(eq(learningPaths.id, projectRecord.pathId));

          await this.certificationsService.issueCertificate(userId, projectRecord.pathId);
        }
      }
    });

    let xpResult = null;
    let firstProjectBadgeResult = null;

    if (passed) {
      try {
        xpResult = await this.gamificationService.addXp(userId, 100);
        
        const awardRes = await this.gamificationService.awardBadgeByCode(userId, 'first_project');
        if (awardRes.success) {
          firstProjectBadgeResult = awardRes.badge;
        }
      } catch (e) {
        this.logger.error('Failed to award project passing XP/badge', e);
      }
    }

    return {
      score,
      passed,
      feedbackText,
      gaps,
      xpResult: xpResult ? { ...xpResult, awardedBadge: firstProjectBadgeResult } : null,
    };
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
