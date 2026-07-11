'use client';

import { useJobKompassTheme } from "@/providers/jkThemeProvider";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useState } from "react";

export default function ProfilePage() {
  const { theme, styles } = useJobKompassTheme();
  const migrateUserIds = useMutation(api.documents.migrateUserIds);
  const [migrationStatus, setMigrationStatus] = useState<{
    loading: boolean;
    success?: boolean;
    message?: string;
    breakdown?: any;
  }>({ loading: false });

  const handleMigration = async () => {
    setMigrationStatus({ loading: true });
    try {
      const result = await migrateUserIds();
      setMigrationStatus({
        loading: false,
        success: true,
        message: result.message,
        breakdown: result.breakdown,
      });
    } catch (error) {
      setMigrationStatus({
        loading: false,
        success: false,
        message: error instanceof Error ? error.message : 'Migration failed',
      });
    }
  };

  return (
    <div className={`transition-colors duration-300 w-screen min-h-screen ${theme === 'dark' ? 'dark' : ''}`}>
      <div className="max-w-4xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
        <h1 className="text-3xl font-bold mb-8" style={{ color: styles.text.primary }}>Your Profile</h1>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-1" />
          <div className="md:col-span-2 space-y-6">
            <div className="p-6 rounded-lg border" style={{ background: 'var(--card)', color: 'var(--card-foreground)', borderColor: 'var(--border)' }}>
              <h2 className="text-xl font-semibold mb-4">Job Applications</h2>
              <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
                Once logged in, you'll be able to see your saved job applications and track your progress.
              </p>
            </div>

            <div className="p-6 rounded-lg border" style={{ background: 'var(--card)', color: 'var(--card-foreground)', borderColor: 'var(--border)' }}>
              <h2 className="text-xl font-semibold mb-4">Data Migration</h2>
              <p className="text-sm mb-4" style={{ color: 'var(--muted-foreground)' }}>
                If you're experiencing issues accessing your resumes or documents, you may need to run a one-time migration to update your data format.
              </p>
              
              <button
                onClick={handleMigration}
                disabled={migrationStatus.loading}
                className="px-4 py-2 rounded-md font-medium text-sm transition-colors"
                style={{
                  backgroundColor: migrationStatus.loading ? 'var(--muted)' : 'var(--primary)',
                  color: 'var(--primary-foreground)',
                  opacity: migrationStatus.loading ? 0.6 : 1,
                  cursor: migrationStatus.loading ? 'not-allowed' : 'pointer',
                }}
              >
                {migrationStatus.loading ? 'Migrating...' : 'Run Migration'}
              </button>

              {migrationStatus.message && (
                <div 
                  className={`mt-4 p-4 rounded-md border ${migrationStatus.success ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}
                >
                  <p className={`text-sm font-medium ${migrationStatus.success ? 'text-green-800' : 'text-red-800'}`}>
                    {migrationStatus.message}
                  </p>
                  {migrationStatus.breakdown && (
                    <div className="mt-2 text-xs" style={{ color: 'var(--muted-foreground)' }}>
                      <p>Migrated documents:</p>
                      <ul className="list-disc list-inside ml-2">
                        <li>Resumes: {migrationStatus.breakdown.resumes}</li>
                        <li>Resume IRs: {migrationStatus.breakdown.resumeIRs}</li>
                        <li>Cover Letters: {migrationStatus.breakdown.coverLetters}</li>
                        <li>Email Templates: {migrationStatus.breakdown.emailTemplates}</li>
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 