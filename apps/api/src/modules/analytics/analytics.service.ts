import { Injectable, Logger } from '@nestjs/common';
import { db, analytics, activityLogs, files, exams, flashcardSets, subjects, eq, and, asc, desc, sql } from '@studyai/database';
import { ActivityAction, OverviewStats, WeeklyReport, MonthlyReport } from '@studyai/types';

@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);

  async logActivity(
    userId: string,
    action: ActivityAction,
    resourceType?: string,
    resourceId?: string,
    metadata?: Record<string, any>,
    ipAddress?: string,
    userAgent?: string,
  ) {
    try {
      const [log] = await db
        .insert(activityLogs)
        .values({
          userId,
          action,
          resourceType: resourceType || null,
          resourceId: resourceId || null,
          metadata: metadata || null,
          ipAddress: ipAddress || null,
          userAgent: userAgent || null,
        })
        .returning();
      return log;
    } catch (error) {
      this.logger.error(`Failed to log activity for user ${userId}`, error);
    }
  }

  async incrementDailyMetric(
    userId: string,
    dateStr: string,
    field: 'filesUploaded' | 'examsTaken' | 'questionsAnswered' | 'correctAnswers' | 'flashcardsReviewed' | 'studyMinutes',
    value: number,
  ) {
    const existing = await db
      .select()
      .from(analytics)
      .where(and(eq(analytics.userId, userId), eq(analytics.date, dateStr)))
      .limit(1);

    if (existing.length > 0) {
      const updateObj: Record<string, any> = {};
      updateObj[field] = sql`${analytics[field]} + ${value}`;

      const [updated] = await db
        .update(analytics)
        .set(updateObj)
        .where(and(eq(analytics.userId, userId), eq(analytics.date, dateStr)))
        .returning();
      return updated;
    } else {
      const insertObj: Record<string, any> = {
        userId,
        date: dateStr,
        filesUploaded: 0,
        examsTaken: 0,
        questionsAnswered: 0,
        correctAnswers: 0,
        flashcardsReviewed: 0,
        studyMinutes: 0,
        avgScore: '0.00',
      };
      insertObj[field] = value;
      const [inserted] = await db.insert(analytics).values(insertObj as any).returning();
      return inserted;
    }
  }

  async updateDailyAverageScore(userId: string, dateStr: string, newScore: number) {
    const existing = await db
      .select()
      .from(analytics)
      .where(and(eq(analytics.userId, userId), eq(analytics.date, dateStr)))
      .limit(1);

    if (existing.length > 0) {
      const record = existing[0];
      const prevExams = record.examsTaken;
      const prevAvg = parseFloat(record.avgScore);

      const totalExams = prevExams + 1;
      const updatedAvg = ((prevAvg * prevExams) + newScore) / totalExams;

      await db
        .update(analytics)
        .set({
          examsTaken: totalExams,
          avgScore: updatedAvg.toFixed(2),
        })
        .where(and(eq(analytics.userId, userId), eq(analytics.date, dateStr)));
    } else {
      await db.insert(analytics).values({
        userId,
        date: dateStr,
        examsTaken: 1,
        avgScore: newScore.toFixed(2),
      });
    }
  }

  async getStudentMetrics(userId: string) {
    const [fileCountResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(files)
      .where(eq(files.userId, userId));
    const totalUploads = Number(fileCountResult?.count || 0);

    const [examCountResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(exams)
      .where(and(eq(exams.userId, userId), eq(exams.status, 'completed')));
    const examsCompleted = Number(examCountResult?.count || 0);

    const [flashcardReviewsResult] = await db
      .select({ sum: sql<number>`coalesce(sum(${flashcardSets.reviewCount}), 0)` })
      .from(flashcardSets)
      .where(eq(flashcardSets.userId, userId));
    const flashcardReviews = Number(flashcardReviewsResult?.sum || 0);

    const [avgScoreResult] = await db
      .select({ avg: sql<number>`coalesce(avg(cast(${exams.score} as decimal)), 0)` })
      .from(exams)
      .where(and(eq(exams.userId, userId), eq(exams.status, 'completed')));
    const averageQuizScore = parseFloat(Number(avgScoreResult?.avg || 0).toFixed(2));

    const [studyMinutesResult] = await db
      .select({ sum: sql<number>`coalesce(sum(${analytics.studyMinutes}), 0)` })
      .from(analytics)
      .where(eq(analytics.userId, userId));
    const studyDurationMinutes = Number(studyMinutesResult?.sum || 0);

    return {
      totalUploads,
      examsCompleted,
      flashcardReviews,
      averageQuizScore,
      studyDurationMinutes,
    };
  }

  /**
   * Returns paginated activity logs for a single user.
   * Powers: GET /api/analytics/activity
   */
  async getActivityLogs(userId: string, limit = 20, page = 1) {
    const offset = (page - 1) * limit;

    const logs = await db
      .select()
      .from(activityLogs)
      .where(eq(activityLogs.userId, userId))
      .orderBy(desc(activityLogs.createdAt))
      .limit(limit)
      .offset(offset);

    const [countResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(activityLogs)
      .where(eq(activityLogs.userId, userId));

    return {
      data: logs,
      pagination: {
        page,
        limit,
        total: Number(countResult?.count || 0),
      },
    };
  }

  async getDailyProgress(userId: string, limitDays = 30) {
    const records = await db
      .select()
      .from(analytics)
      .where(eq(analytics.userId, userId))
      .orderBy(desc(analytics.date))
      .limit(limitDays);

    return records.reverse();
  }

  async getSubjectMetrics(userId: string) {
    const userSubjects = await db
      .select()
      .from(subjects)
      .where(eq(subjects.userId, userId));

    const metrics = [];

    for (const subject of userSubjects) {
      const [filesCountResult] = await db
        .select({ count: sql<number>`count(*)` })
        .from(files)
        .where(and(eq(files.userId, userId), eq(files.subjectId, subject.id)));
      const fileCount = Number(filesCountResult?.count || 0);

      const [examsCountResult] = await db
        .select({ count: sql<number>`count(*)` })
        .from(exams)
        .innerJoin(files, eq(exams.fileId, files.id))
        .where(and(eq(files.userId, userId), eq(files.subjectId, subject.id)));
      const examCount = Number(examsCountResult?.count || 0);

      const [flashcardSetsCountResult] = await db
        .select({ count: sql<number>`count(*)` })
        .from(flashcardSets)
        .innerJoin(files, eq(flashcardSets.fileId, files.id))
        .where(and(eq(files.userId, userId), eq(files.subjectId, subject.id)));
      const flashcardSetCount = Number(flashcardSetsCountResult?.count || 0);

      metrics.push({
        id: subject.id,
        name: subject.name,
        color: subject.color,
        icon: subject.icon,
        fileCount,
        examCount,
        flashcardSetCount,
      });
    }

    return metrics;
  }

  async generateWeeklyReport(userId: string): Promise<WeeklyReport> {
    const days: string[] = [];
    const studyMinutes: number[] = [];
    const questionsAnswered: number[] = [];
    const correctAnswers: number[] = [];

    const dateMap = new Map<string, { studyMinutes: number; questionsAnswered: number; correctAnswers: number }>();

    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const dayName = d.toLocaleDateString('en-US', { weekday: 'short' });
      days.push(dayName);

      dateMap.set(dateStr, { studyMinutes: 0, questionsAnswered: 0, correctAnswers: 0 });
    }

    const firstDateStr = Array.from(dateMap.keys())[0];
    const records = await db
      .select()
      .from(analytics)
      .where(and(eq(analytics.userId, userId), sql`${analytics.date} >= ${firstDateStr}`))
      .orderBy(asc(analytics.date));

    for (const record of records) {
      if (dateMap.has(record.date)) {
        dateMap.set(record.date, {
          studyMinutes: record.studyMinutes,
          questionsAnswered: record.questionsAnswered,
          correctAnswers: record.correctAnswers,
        });
      }
    }

    const dates = Array.from(dateMap.keys());
    for (const dateStr of dates) {
      const val = dateMap.get(dateStr)!;
      studyMinutes.push(val.studyMinutes);
      questionsAnswered.push(val.questionsAnswered);
      correctAnswers.push(val.correctAnswers);
    }

    return {
      days,
      studyMinutes,
      questionsAnswered,
      correctAnswers,
    };
  }

  async generateMonthlyReport(userId: string): Promise<MonthlyReport> {
    const weeks = ['Week 1', 'Week 2', 'Week 3', 'Week 4'];
    const studyMinutes = [0, 0, 0, 0];
    const filesUploaded = [0, 0, 0, 0];
    const weekScores: number[][] = [[], [], [], []];

    const today = new Date();
    const startDate = new Date();
    startDate.setDate(today.getDate() - 27);
    const startDateStr = startDate.toISOString().split('T')[0];

    const records = await db
      .select()
      .from(analytics)
      .where(and(eq(analytics.userId, userId), sql`${analytics.date} >= ${startDateStr}`))
      .orderBy(asc(analytics.date));

    for (const record of records) {
      const recordDate = new Date(record.date);
      const diffTime = today.getTime() - recordDate.getTime();
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

      if (diffDays >= 0 && diffDays < 28) {
        const weekIndex = 3 - Math.floor(diffDays / 7);
        if (weekIndex >= 0 && weekIndex < 4) {
          studyMinutes[weekIndex] += record.studyMinutes;
          filesUploaded[weekIndex] += record.filesUploaded;

          const score = parseFloat(record.avgScore);
          if (score > 0 || record.examsTaken > 0) {
            weekScores[weekIndex].push(score);
          }
        }
      }
    }

    const avgScore = weekScores.map((scores) => {
      if (scores.length === 0) return 0;
      const sum = scores.reduce((a, b) => a + b, 0);
      return parseFloat((sum / scores.length).toFixed(2));
    });

    return {
      weeks,
      studyMinutes,
      filesUploaded,
      avgScore,
    };
  }

  async getOverviewStats(userId: string): Promise<OverviewStats> {
    const [fileCountResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(files)
      .where(eq(files.userId, userId));
    const totalFiles = Number(fileCountResult?.count || 0);

    const [examCountResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(exams)
      .where(and(eq(exams.userId, userId), eq(exams.status, 'completed')));
    const totalExams = Number(examCountResult?.count || 0);

    const [studyMinutesResult] = await db
      .select({ sum: sql<number>`coalesce(sum(${analytics.studyMinutes}), 0)` })
      .from(analytics)
      .where(eq(analytics.userId, userId));
    const totalStudyHours = parseFloat((Number(studyMinutesResult?.sum || 0) / 60).toFixed(1));

    const [totalExamsResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(exams)
      .where(eq(exams.userId, userId));
    const totalExamsCount = Number(totalExamsResult?.count || 0);
    const completionRate = totalExamsCount > 0 ? Math.round((totalExams / totalExamsCount) * 100) : 0;

    const today = new Date();

    const currentWeekStart = new Date();
    currentWeekStart.setDate(today.getDate() - 6);
    const currentWeekStartStr = currentWeekStart.toISOString().split('T')[0];

    const prevWeekStart = new Date();
    prevWeekStart.setDate(today.getDate() - 13);
    const prevWeekStartStr = prevWeekStart.toISOString().split('T')[0];

    const currentRecords = await db
      .select()
      .from(analytics)
      .where(and(eq(analytics.userId, userId), sql`${analytics.date} >= ${currentWeekStartStr}`))
      .orderBy(asc(analytics.date));

    const prevRecords = await db
      .select()
      .from(analytics)
      .where(and(
        eq(analytics.userId, userId),
        sql`${analytics.date} >= ${prevWeekStartStr}`,
        sql`${analytics.date} < ${currentWeekStartStr}`,
      ))
      .orderBy(asc(analytics.date));

    let currentFiles = 0;
    let currentExams = 0;
    let currentStudyMinutes = 0;
    let currentQuestions = 0;
    let currentCorrect = 0;

    for (const r of currentRecords) {
      currentFiles += r.filesUploaded;
      currentExams += r.examsTaken;
      currentStudyMinutes += r.studyMinutes;
      currentQuestions += r.questionsAnswered;
      currentCorrect += r.correctAnswers;
    }

    let prevFiles = 0;
    let prevExams = 0;
    let prevStudyMinutes = 0;
    let prevQuestions = 0;
    let prevCorrect = 0;

    for (const r of prevRecords) {
      prevFiles += r.filesUploaded;
      prevExams += r.examsTaken;
      prevStudyMinutes += r.studyMinutes;
      prevQuestions += r.questionsAnswered;
      prevCorrect += r.correctAnswers;
    }

    const currentStudyHours = currentStudyMinutes / 60;
    const prevStudyHours = prevStudyMinutes / 60;

    const currentComp = currentQuestions > 0 ? (currentCorrect / currentQuestions) * 100 : 0;
    const prevComp = prevQuestions > 0 ? (prevCorrect / prevQuestions) * 100 : 0;

    const calculateDiff = (curr: number, prev: number) => {
      if (prev === 0) return curr > 0 ? 100 : 0;
      return parseFloat((((curr - prev) / prev) * 100).toFixed(1));
    };

    return {
      filesUploaded: totalFiles,
      examsTaken: totalExams,
      studyHours: totalStudyHours,
      completionRate,
      weeklyComparison: {
        filesUploaded: calculateDiff(currentFiles, prevFiles),
        examsTaken: calculateDiff(currentExams, prevExams),
        studyHours: calculateDiff(currentStudyHours, prevStudyHours),
        completionRate: parseFloat((currentComp - prevComp).toFixed(1)),
      },
    };
  }
}
