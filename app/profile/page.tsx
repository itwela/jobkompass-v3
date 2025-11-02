'use client';

import { useJobKompassTheme } from "@/providers/jkThemeProvider";

export default function ProfilePage() {
  const { theme, styles } = useJobKompassTheme();

  return (
    <div className={`transition-colors duration-300 w-screen min-h-screen ${theme === 'dark' ? 'dark' : ''}`}>
      <div className="max-w-4xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
        <h1 className="text-3xl font-bold mb-8" style={{ color: styles.text.primary }}>Your Profile</h1>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-1" />
          <div className="md:col-span-2">
            <div className="p-6 rounded-lg border" style={{ background: 'var(--card)', color: 'var(--card-foreground)', borderColor: 'var(--border)' }}>
              <h2 className="text-xl font-semibold mb-4">Job Applications</h2>
              <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
                Once logged in, you'll be able to see your saved job applications and track your progress.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 