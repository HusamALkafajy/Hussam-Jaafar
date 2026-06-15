import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { db, learningPaths, learningStages, lessons, projects, certifications, knowledgeGaps, aiTokenUsage, eq, and, asc, sql } from '@studyai/database';
import { CreatePathDto } from './dto/create-path.dto';
import { AiService } from '../ai/ai.service';
import * as crypto from 'crypto';

@Injectable()
export class LearningPathsService {
  private readonly logger = new Logger(LearningPathsService.name);

  constructor(private readonly aiService: AiService) {}

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

    // 3. Auto-unlock project if all lessons in the stage are completed
    // We can return details to the client
    return {
      success: true,
      lesson: updatedLesson,
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
