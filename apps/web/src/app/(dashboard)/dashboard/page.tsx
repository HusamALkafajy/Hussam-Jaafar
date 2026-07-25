'use client';

import React from 'react';
import Link from 'next/link';
import { useAuth } from '../../../hooks/use-auth';
import { useLocale } from '../../../hooks/use-locale';
import { Card, CardHeader, CardTitle, CardContent } from '../../../components/ui/card';
import { Badge } from '../../../components/ui/badge';
import { Button } from '../../../components/ui/button';
import { Grid } from '../../../components/ui/grid';
import { Stack } from '../../../components/ui/stack';
import { Section } from '../../../components/ui/section';
import { Container } from '../../../components/ui/container';
import { Surface } from '../../../components/ui/surface';
import {
  FileText,
  Clock,
  CheckSquare,
  Award,
  Upload,
  BookOpen,
  ArrowRight,
  GraduationCap,
  Sparkles,
  Flame,
  Pin,
  Bot
} from 'lucide-react';
import { MOCK_DASHBOARD_DATA } from '../../../mocks/workspace';
import { formatDate } from '../../../lib/utils';
import { ActivityFeed } from '../../../components/activity-feed';
import { UploadQueue } from '../../../components/upload/upload-queue';
import { useFTUE } from '../../../hooks/use-ftue';
import { FTUEDashboardEmpty } from '../../../components/onboarding/ftue-dashboard-empty';
import { RecommendationsPanel } from '../../../components/dashboard/recommendations/recommendations-panel';

export default function DashboardPage() {
  const { t, locale } = useLocale();
  const { user } = useAuth();
  const { state: ftueState, isReady } = useFTUE();
  
  const data = MOCK_DASHBOARD_DATA;

  const statCards = [
    { label: "Study Time", value: `${data.statistics.totalStudyTimeHours}h`, icon: Clock, color: 'text-amber-500 bg-amber-500/10' },
    { label: "Documents", value: data.statistics.documentsRead, icon: FileText, color: 'text-indigo-500 bg-indigo-500/10' },
    { label: "Quizzes", value: data.statistics.quizzesCompleted, icon: CheckSquare, color: 'text-emerald-500 bg-emerald-500/10' },
    { label: "Average Score", value: `${data.statistics.averageScore}%`, icon: Award, color: 'text-rose-500 bg-rose-500/10' },
  ];

  if (isReady && data.statistics.documentsRead === 0 && !ftueState.hasUploadedDocument) {
    return (
      <Container size="xl" className="py-8">
        <FTUEDashboardEmpty />
      </Container>
    );
  }

  return (
    <Container size="xl" className="py-8">
      <Stack gap={8}>
        {/* Welcome Section & Learning Streak */}
        <Surface variant="glass" className="p-6 md:p-8 flex flex-col md:flex-row items-center justify-between gap-6 border-primary/20">
          <Stack gap={2} className="text-center md:text-start flex-1">
            <h1 className="text-2xl md:text-3xl font-bold text-foreground">
              {data.welcomeMessage}
            </h1>
            <p className="text-muted-foreground max-w-xl">
              You are on a <strong className="text-foreground">{data.statistics.currentStreakDays} day</strong> learning streak. Keep it up!
            </p>
          </Stack>
          <div className="flex items-center gap-3 bg-background/50 p-4 rounded-xl border border-border shrink-0">
            <div className="p-3 bg-orange-500/10 text-orange-500 rounded-lg">
              <Flame className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Current Streak</p>
              <p className="text-2xl font-bold">{data.statistics.currentStreakDays} <span className="text-sm font-normal text-muted-foreground">days</span></p>
            </div>
          </div>
        </Surface>

        {/* Overview Stats */}
        <Grid cols={1} gap={4}>
          {statCards.map((stat, i) => {
            const Icon = stat.icon;
            return (
              <Card key={i} className="flex items-center gap-4 p-4 hover:border-primary/50 transition-colors">
                <div className={`p-3 rounded-lg shrink-0 ${stat.color}`}>
                  <Icon className="w-5 h-5" />
                </div>
                <div className="flex flex-col gap-0.5 min-w-0">
                  <span className="text-sm text-muted-foreground truncate">{stat.label}</span>
                  <span className="text-xl font-bold text-foreground truncate">{stat.value}</span>
                </div>
              </Card>
            );
          })}
        </Grid>

        <Grid cols={1} gap={8}>
          {/* Main Content Column */}
          <Stack gap={8} className="lg:col-span-2">
            
            {/* Personalized Recommendations Panel (Consumes API) */}
            <RecommendationsPanel />

            {/* Recent Subjects */}
            <Section>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold">Recent Subjects</h3>
                <Link href="/subjects">
                  <Button variant="link" className="text-primary p-0">
                    View All <ArrowRight className="ms-1 w-4 h-4 rtl:-scale-x-100" />
                  </Button>
                </Link>
              </div>
              <Grid cols={1} gap={4}>
                {data.recentSubjects.map(subject => (
                  <Card key={subject.id} className="p-4 hover:border-primary/50 transition-colors cursor-pointer group flex flex-col items-center text-center gap-3">
                    <div className="p-4 bg-muted rounded-full group-hover:scale-110 transition-transform">
                      <GraduationCap className="w-6 h-6 text-foreground" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-foreground line-clamp-1">{subject.name}</h4>
                      <p className="text-xs text-muted-foreground">{subject.documentCount} items</p>
                    </div>
                  </Card>
                ))}
              </Grid>
            </Section>
            
          </Stack>

          {/* Sidebar Column */}
          <Stack gap={8}>
            {/* Quick Actions Panel */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Quick Actions</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                <Link href="/upload">
                  <Button className="w-full justify-start" size="lg">
                    <Upload className="me-2 w-4 h-4" />
                    Upload New File
                  </Button>
                </Link>
                <Button variant="outline" className="w-full justify-start" size="lg">
                  <Bot className="me-2 w-4 h-4" />
                  Chat with AI Tutor
                </Button>
                <Button variant="outline" className="w-full justify-start" size="lg">
                  <Sparkles className="me-2 w-4 h-4" />
                  Generate Flashcards
                </Button>
              </CardContent>
            </Card>

            {/* Processing Queue Widget */}
            <Card>
              <CardContent className="p-4">
                <UploadQueue variant="compact" />
              </CardContent>
            </Card>

            {/* Activity Feed */}
            <Card>
              <CardHeader className="pb-3 flex flex-row items-center justify-between">
                <CardTitle className="text-lg">Activity Feed</CardTitle>
              </CardHeader>
              <CardContent>
                <ActivityFeed items={data.activityFeed} />
              </CardContent>
            </Card>

            {/* Upcoming Reviews Placeholder */}
            <Card className="bg-muted/50 border-dashed">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg text-muted-foreground">Upcoming Reviews</CardTitle>
              </CardHeader>
              <CardContent>
                <Stack gap={4}>
                  {data.upcomingReviews.map(review => (
                    <div key={review.id} className="flex flex-col gap-1 pb-4 border-b last:border-0 last:pb-0">
                      <span className="text-sm font-medium">{review.title}</span>
                      <span className="text-xs text-muted-foreground">{formatDate(review.date, locale)}</span>
                    </div>
                  ))}
                </Stack>
              </CardContent>
            </Card>
          </Stack>
        </Grid>
      </Stack>
    </Container>
  );
}
