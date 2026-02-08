'use client'

import { useState, useEffect, useMemo } from 'react'
import { useAuth } from '@/providers/jkAuthProvider'
import { useSubscription } from '@/providers/jkSubscriptionProvider'
import { useJobs } from '@/providers/jkJobsProvider'
import { useJobKompassResume } from '@/providers/jkResumeProvider'
import { useFeatureAccess } from '@/hooks/useFeatureAccess'
import { Button } from '@/components/ui/button'
import { motion } from 'framer-motion'
import {
  TrendingUp,
  Briefcase,
  FileText,
  Award,
  Target,
  Sparkles,
  LogIn,
  Loader2,
  TrendingDown,
  CheckCircle2,
  CreditCard,
  RefreshCw
} from 'lucide-react'
import { BlurFade } from '@/components/ui/blur-fade'

interface PerformanceStats {
  totalJobs: number;
  statusCounts: Record<string, number>;
  resumeStats: Record<string, {
    totalJobs: number;
    offered: number;
    rejected: number;
    ghosted: number;
    applied: number;
    callback: number;
    interviewing: number;
  }>;
  coverLetterStats: Record<string, {
    totalJobs: number;
    offered: number;
    rejected: number;
    ghosted: number;
    applied: number;
    callback: number;
    interviewing: number;
  }>;
  documentsGeneratedThisMonth?: number;
  jobsCount?: number;
}

function StatusBar({
  label,
  count,
  total,
  colorClass
}: {
  label: string;
  count: number;
  total: number;
  colorClass: string;
}) {
  const percentage = total > 0 ? (count / total) * 100 : 0;

  return (
    <div className="space-y-2">
      <div className="flex justify-between items-center text-sm">
        <span className="font-medium text-foreground">{label}</span>
        <span className="text-muted-foreground">{count} ({percentage.toFixed(0)}%)</span>
      </div>
      <div className="h-3 bg-muted rounded-full overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${percentage}%` }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className={`h-full ${colorClass} rounded-full`}
        />
      </div>
    </div>
  );
}

function ResumePerformanceCard({
  name,
  stats
}: {
  name: string;
  stats: {
    totalJobs: number;
    offered: number;
    rejected: number;
    ghosted: number;
    applied: number;
    callback: number;
    interviewing: number;
  };
}) {
  const successRate = stats.totalJobs > 0
    ? ((stats.offered / stats.totalJobs) * 100).toFixed(0)
    : '0';
  const interviewRate = stats.totalJobs > 0
    ? ((stats.interviewing / stats.totalJobs) * 100).toFixed(0)
    : '0';

  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-4">
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-base truncate">{name}</h3>
          <p className="text-sm text-muted-foreground mt-0.5">{stats.totalJobs} applications</p>
        </div>
        <FileText className="h-5 w-5 text-muted-foreground flex-shrink-0 ml-2" />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-lg bg-green-100 p-3 border border-green-200">
          <div className="text-2xl font-bold text-green-800">{successRate}%</div>
          <div className="text-xs text-green-700 mt-0.5">Offer rate</div>
          <div className="text-xs text-muted-foreground mt-1">{stats.offered} offers</div>
        </div>

        <div className="rounded-lg bg-purple-100 p-3 border border-purple-200">
          <div className="text-2xl font-bold text-purple-800">{interviewRate}%</div>
          <div className="text-xs text-purple-700 mt-0.5">Interview rate</div>
          <div className="text-xs text-muted-foreground mt-1">{stats.interviewing} interviews</div>
        </div>
      </div>

      <div className="pt-3 border-t border-border/50 grid grid-cols-4 gap-2 text-xs">
        <div className="text-center">
          <div className="font-medium text-amber-800">{stats.applied}</div>
          <div className="text-muted-foreground">Applied</div>
        </div>
        <div className="text-center">
          <div className="font-medium text-cyan-800">{stats.callback ?? 0}</div>
          <div className="text-muted-foreground">Callback</div>
        </div>
        <div className="text-center">
          <div className="font-medium text-red-800">{stats.rejected}</div>
          <div className="text-muted-foreground">Rejected</div>
        </div>
        <div className="text-center">
          <div className="font-medium text-gray-600">{stats.ghosted}</div>
          <div className="text-muted-foreground">Ghosted</div>
        </div>
      </div>
    </div>
  );
}

export default function JkCW_PerformanceMode() {
  const { isAuthenticated, isLoading } = useAuth();
  const { isFree } = useSubscription();
  const { allJobs, statusCounts, statusOptions } = useJobs();
  const { resumeStats, coverLetterStats } = useJobKompassResume();
  const { getUsageStats } = useFeatureAccess();
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [isLoadingSummary, setIsLoadingSummary] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);

  const stats: PerformanceStats = useMemo(() => {
    const usage = getUsageStats();
    return {
      totalJobs: allJobs.length,
      statusCounts,
      resumeStats: resumeStats || {},
      coverLetterStats: coverLetterStats || {},
      documentsGeneratedThisMonth: usage.documentsUsed,
      jobsCount: usage.jobsUsed,
    };
  }, [allJobs.length, statusCounts, resumeStats, coverLetterStats, getUsageStats]);

  // Generate AI summary on mount or when stats change significantly
  useEffect(() => {
    if (!isAuthenticated || stats.totalJobs === 0) return;

    const generateSummary = async () => {
      setIsLoadingSummary(true);
      setSummaryError(null);

      try {
        const response = await fetch('/api/performance/summary', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(stats),
        });

        const data = await response.json();

        if (!response.ok || !data.success) {
          throw new Error(data.error || 'Failed to generate summary');
        }

        setAiSummary(data.summary);
      } catch (error) {
        console.error('Error generating summary:', error);
        setSummaryError(error instanceof Error ? error.message : 'Failed to generate summary');
      } finally {
        setIsLoadingSummary(false);
      }
    };

    generateSummary();
  }, [isAuthenticated, stats.totalJobs]); // Only regenerate when job count changes

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center px-6">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mb-4" />
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="flex flex-col h-full overflow-y-auto chat-scroll bg-gradient-to-br from-background via-background to-muted/20">
        <div className="max-w-7xl mx-auto w-full px-6 py-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center justify-center min-h-[60vh] text-center"
          >
            <div className="text-6xl mb-4">🔒</div>
            <h2 className="text-2xl font-semibold mb-2">Sign in required</h2>
            <p className="text-muted-foreground mb-6 max-w-md">
              Please sign in to view your job hunt performance analytics and personalized insights.
            </p>
            <Button
              onClick={() => {
                window.dispatchEvent(new CustomEvent('jk:openSignIn'));
              }}
              className="gap-2"
            >
              <LogIn className="h-4 w-4" />
              Open Sign In
            </Button>
          </motion.div>
        </div>
      </div>
    );
  }

  // Free users need to subscribe
  if (isFree) {
    return (
      <div className="flex flex-col h-full overflow-y-auto chat-scroll bg-gradient-to-br from-background via-background to-muted/20">
        <div className="max-w-7xl mx-auto w-full px-6 py-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center justify-center min-h-[60vh] text-center"
          >
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-primary/10 text-primary mb-6">
              <TrendingUp className="h-10 w-10" />
            </div>
            <h2 className="text-2xl font-semibold mb-2">Unlock Performance</h2>
            <p className="text-muted-foreground mb-6 max-w-md">
              Performance analytics and AI-powered insights are available on Starter, Plus, and Pro plans. Subscribe to track your job hunt progress and get personalized recommendations.
            </p>
            <Button asChild className="gap-2">
              <a href="/pricing">
                <CreditCard className="h-4 w-4" />
                View plans
              </a>
            </Button>
          </motion.div>
        </div>
      </div>
    );
  }

  // Empty state
  if (stats.totalJobs === 0) {
    return (
      <div className="flex flex-col h-full overflow-y-auto chat-scroll bg-gradient-to-br from-background via-background to-muted/20">
        <div className="max-w-7xl mx-auto w-full px-6 py-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center justify-center min-h-[60vh] text-center"
          >
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-primary/10 text-primary mb-6">
              <TrendingUp className="h-10 w-10" />
            </div>
            <h2 className="text-2xl font-semibold mb-2">No jobs tracked yet</h2>
            <p className="text-muted-foreground mb-6 max-w-md">
              Add jobs to My Jobs to start tracking your application performance and get personalized insights.
            </p>
            <Button
              onClick={() => {
                window.dispatchEvent(new CustomEvent('jk:switchMode', { detail: '/jobs' }));
              }}
            >
              <Briefcase className="h-4 w-4 mr-2" />
              Go to My Jobs
            </Button>
          </motion.div>
        </div>
      </div>
    );
  }

  const topResumes = Object.entries(stats.resumeStats)
    .sort((a, b) => {
      const [dataA, dataB] = [a[1], b[1]];
      if (dataA.offered !== dataB.offered) return dataB.offered - dataA.offered;
      if (dataA.interviewing !== dataB.interviewing) return dataB.interviewing - dataA.interviewing;
      if ((dataA.callback ?? 0) !== (dataB.callback ?? 0)) return (dataB.callback ?? 0) - (dataA.callback ?? 0);
      if (dataA.applied !== dataB.applied) return dataB.applied - dataA.applied;
      return dataA.rejected - dataB.rejected; // fewer rejected = better
    });

  const overallSuccessRate = stats.totalJobs > 0
    ? ((stats.statusCounts.Offered || 0) / stats.totalJobs * 100).toFixed(1)
    : '0';

  const overallInterviewRate = stats.totalJobs > 0
    ? ((stats.statusCounts.Interviewing || 0) / stats.totalJobs * 100).toFixed(1)
    : '0';

  return (
    <div className="flex flex-col h-full overflow-y-auto chat-scroll bg-gradient-to-br from-background via-background to-muted/20">
      <div className="max-w-7xl mx-auto w-full px-6 py-8">
        {/* Header */}
        <BlurFade delay={0.05} inView={false}>
          <div className="mb-6">
            <h1 className="text-3xl font-bold tracking-tight">Performance</h1>
            <p className="text-muted-foreground mt-1">Track your job hunt progress and insights</p>
          </div>
        </BlurFade>

        {/* AI Summary Card */}
        <BlurFade delay={0.1} inView={false}>
          <div className="mb-6 rounded-xl border border-border bg-gradient-to-br from-primary/5 via-primary/3 to-background p-6">
            <div className="flex items-start gap-3">
              <div className="rounded-lg bg-primary/10 p-2.5 flex-shrink-0">
                <Sparkles className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0 overflow-visible">
                <h2 className="font-semibold text-base mb-2">AI Performance Insights</h2>
                {isLoadingSummary ? (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span className="text-sm">Analyzing your job hunt...</span>
                  </div>
                ) : summaryError ? (
                  <div className="flex items-center gap-3">
                    <p className="text-sm text-muted-foreground">There was a hiccup generating your AI summary.</p>
                    <Button
                      size="sm"
                      variant="outline"
                      className="shrink-0 gap-1.5"
                      onClick={() => {
                        setIsLoadingSummary(true);
                        setSummaryError(null);
                        fetch('/api/performance/summary', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify(stats),
                        })
                          .then(res => res.json())
                          .then(data => {
                            if (data.success) {
                              setAiSummary(data.summary);
                            } else {
                              setSummaryError(data.error);
                            }
                          })
                          .catch(err => setSummaryError(err.message))
                          .finally(() => setIsLoadingSummary(false));
                      }}
                    >
                      <RefreshCw className="h-3.5 w-3.5" />
                      Try Again
                    </Button>
                  </div>
                ) : aiSummary ? (
                  <p className="text-sm leading-relaxed text-foreground break-words whitespace-pre-wrap">{aiSummary}</p>
                ) : (
                  <p className="text-sm text-muted-foreground">No insights available yet.</p>
                )}
              </div>
            </div>
          </div>
        </BlurFade>

        {/* Key Metrics */}
        <BlurFade delay={0.15} inView={false}>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="rounded-xl border border-border bg-card p-5">
              <div className="flex items-center justify-between mb-3">
                <Target className="h-5 w-5 text-primary" />
                <span className="text-2xl font-bold text-foreground">{stats.totalJobs}</span>
              </div>
              <div className="text-sm font-medium text-foreground">Total Applications</div>
              <div className="text-xs text-muted-foreground mt-1">Jobs tracked</div>
            </div>

            <div className="rounded-xl border border-border bg-card p-5">
              <div className="flex items-center justify-between mb-3">
                <TrendingUp className="h-5 w-5 text-primary" />
                <span className="text-2xl font-bold text-foreground">{overallSuccessRate}%</span>
              </div>
              <div className="text-sm font-medium text-foreground">Offer Rate</div>
              <div className="text-xs text-muted-foreground mt-1">{stats.statusCounts.Offered || 0} offers received</div>
            </div>

            <div className="rounded-xl border border-border bg-card p-5">
              <div className="flex items-center justify-between mb-3">
                <Award className="h-5 w-5 text-primary" />
                <span className="text-2xl font-bold text-foreground">{overallInterviewRate}%</span>
              </div>
              <div className="text-sm font-medium text-foreground">Interview Rate</div>
              <div className="text-xs text-muted-foreground mt-1">{stats.statusCounts.Interviewing || 0} interviews</div>
            </div>
          </div>
        </BlurFade>

        {/* Application Status Breakdown */}
        <BlurFade delay={0.2} inView={false}>
          <div className="rounded-xl border border-border bg-card p-6 mb-6">
            <h2 className="font-semibold text-lg mb-5 flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-muted-foreground" />
              Application Status
            </h2>
            <div className="space-y-4">
              {statusOptions.map((status) => {
                const count = stats.statusCounts[status.value] || 0;
                // Bar colors matching My Jobs status badges (softer 200 variants for progress fill)
                const barColors: Record<string, string> = {
                  Interested: 'bg-blue-200',
                  Applied: 'bg-amber-200',
                  Callback: 'bg-cyan-200',
                  Interviewing: 'bg-purple-200',
                  Offered: 'bg-green-200',
                  Rejected: 'bg-red-200',
                  Ghosted: 'bg-gray-200',
                };
                const barColor = barColors[status.value] ?? 'bg-gray-200';

                return (
                  <StatusBar
                    key={status.value}
                    label={status.label}
                    count={count}
                    total={stats.totalJobs}
                    colorClass={barColor}
                  />
                );
              })}
            </div>
          </div>
        </BlurFade>

        {/* Resume Performance */}
        {topResumes.length > 0 && (
          <BlurFade delay={0.25} inView={false}>
            <div className="mb-6 no-scrollbar">
              <h2 className="font-semibold text-lg mb-4 flex items-center gap-2">
                <FileText className="h-5 w-5 text-muted-foreground" />
                Resume Performance
              </h2>
              <div className="overflow-x-auto overflow-y-hidden pb-2 -mx-1 no-scrollbar">
                <div className="flex gap-4 min-w-max pr-2">
                  {topResumes.map(([name, resumeData], index) => (
                    <BlurFade key={name} delay={0.3 + index * 0.05} inView={false}>
                      <div className="w-[280px] flex-shrink-0">
                        <ResumePerformanceCard name={name} stats={resumeData} />
                      </div>
                    </BlurFade>
                  ))}
                </div>
              </div>
            </div>
          </BlurFade>
        )}

        {/* Usage Stats */}
        {stats.documentsGeneratedThisMonth !== undefined && (
          <BlurFade delay={0.35} inView={false}>
            <div className="rounded-xl border border-border bg-card/50 p-5">
              <h3 className="font-semibold text-base mb-3">This Month</h3>
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm text-muted-foreground">Documents Generated</div>
                  <div className="text-2xl font-bold mt-1">{stats.documentsGeneratedThisMonth}</div>
                </div>
                <FileText className="h-8 w-8 text-muted-foreground" />
              </div>
            </div>
          </BlurFade>
        )}
      </div>
    </div>
  );
}
