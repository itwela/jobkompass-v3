'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';

type ThemeStyles = {
  background: string;
  card: {
    background: string;
    border: string;
    hoverTransform: string;
    accent: string;
    boxShadow: string;
  };
  text: {
    primary: string;
    secondary: string;
    tertiary: string;
    title: string;
    subtitle: string;
    error: string;
    success: string;
  };
  icon: {
    default: string;
    hover: string;
    accent: string;
  };
  nav: {
    background: string;
    border: string;
    activeColor: string;
    inactiveColor: string;
    hoverTransform: string;
    colors: {
      home: string;
      applications: string;
      companyHub: string;
      careerAssistant: string;
      workers: string;
      blog: string;
      settings: string;
      landing: string;
    };
  };
  status: {
    interested: string;
    applied: string;
    interviewing: string;
    offer: string;
    rejected: string;
    ghosted: string;
  };
  form: {
    input: {
      background: string;
      text: string;
      placeholder: string;
      border: string;
      focus: string;
      hover: {
        background: string;
        transform: string;
        shadow: string;
      };
    };
    select: {
      background: string;
      text: string;
      border: string;
      hover: {
        background: string;
        transform: string;
      };
    };
    popup: {
      background: string;
      backdropFilter: string;
      shadow: string;
    };
  };
  black: string;
  white: string;
};

type UtilStyles = {
  typography: {
    fontFamily: {
      sans: string;
      mono: string;
    };
    fontSize: {
      xs: string;
      sm: string;
      base: string;
      lg: string;
      xl: string;
      '2xl': string;
      '3xl': string;
      '4xl': string;
      '5xl': string;
    };
    lineHeight: {
      tight: string;
      base: string;
      relaxed: string;
    };
    fontWeight: {
      normal: string;
      medium: string;
      semibold: string;
      bold: string;
    };
  };
  icon: {
    size: {
      xs: string;
      sm: string;
      base: string;
      lg: string;
      xl: string;
      '2xl': string;
      '3xl': string;
    };
    padding: {
      tight: string;
      base: string;
      relaxed: string;
    };
  };
  spacing: {
    base: string;
    padding: {
      xs: string;
      sm: string;
      base: string;
      md: string;
      lg: string;
      xl: string;
      '2xl': string;
    };
    margin: {
      xs: string;
      sm: string;
      base: string;
      md: string;
      lg: string;
      xl: string;
      '2xl': string;
    };
    layout: {
      containerPadding: string;
      sectionGap: string;
      componentGap: string;
      maxWidth: string;
    };
  };
  effects: {
    shadow: {
      sm: string;
      md: string;
      lg: string;
    };
    borderRadius: {
      sm: string;
      md: string;
      lg: string;
      xl: string;
    };
  };
  components: {
    card: {
      base: string;
      padding: string;
    };
    button: {
      base: string;
      calendar: string;
    };
    input: {
      base: string;
    };
    text: {
      heading: string;
      subtitle: string;
      superSubtitle: string;
      logo: string;
    };
  };
  layout: {
    sidebar: {
      helper: string;
    };
    container: {
      dashboard: string;
      landing: string;
      topLayer: string;
    };
    padding: {
      consoleOpen: string;
      consoleClosed: string;
    };
  };
};


interface JobKompassThemeContextType {
  theme: 'light' | 'dark';
  toggleTheme: () => void;
  styles: ThemeStyles;
  utilStyles: UtilStyles;
}


const JobKompassThemeContext = createContext<JobKompassThemeContextType | null>(null);

export function JobKompassThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  const styles: Record<'light' | 'dark', ThemeStyles> = {
    dark: {
      background: '#1E2A38',
      card: {
        background: '#2A3A4F',
        border: '1px solid rgba(243, 244, 246, 0.1)',
        hoverTransform: 'hover:translate-y-[-2px]',
        accent: 'rgba(243, 244, 246, 0.05)',
        boxShadow: 'rgba(243, 244, 246, 0.1)'
      },
      text: {
        primary: '#F3F4F6',
        secondary: 'rgba(243, 244, 246, 0.7)',
        tertiary: 'rgba(243, 244, 246, 0.4)',
        title: '#F3F4F6',
        subtitle: 'rgba(243, 244, 246, 0.7)',
        error: '#EC4899',
        success: '#10B981'
      },
      icon: {
        default: 'text-gray-300',
        hover: 'text-gray-100',
        accent: '#3B82F6'
      },
      nav: {
        background: '#2A3A4F',
        border: '1px solid rgba(243, 244, 246, 0.1)',
        activeColor: '#F3F4F6',
        inactiveColor: 'rgba(243, 244, 246, 0.7)',
        hoverTransform: 'hover:translate-y-[-2px]',
        colors: {
          home: '#10B981',
          applications: '#3B82F6',
          companyHub: '#6D28D9',
          careerAssistant: '#EC4899',
          workers: '#3B82F6',
          blog: '#F3F4F6',
          settings: '#F3F4F6',
          landing: '#F3F4F6',
        }
      },
      status: {
        interested: '#10B981',
        applied: '#3B82F6',
        interviewing: '#6D28D9',
        offer: '#EC4899',
        rejected: '#EC4899',
        ghosted: '#1E2A38'
      },
      form: {
        input: {
          background: 'rgba(243, 244, 246, 0.05)',
          text: '#F3F4F6',
          placeholder: 'rgba(243, 244, 246, 0.4)',
          border: 'rgba(243, 244, 246, 0.1)',
          focus: '#3B82F6',
          hover: {
            background: 'rgba(243, 244, 246, 0.08)',
            transform: 'translateY(-1px)',
            shadow: '0 4px 12px rgba(30, 42, 56, 0.1)'
          }
        },
        select: {
          background: 'rgba(243, 244, 246, 0.05)',
          text: '#F3F4F6',
          border: 'rgba(243, 244, 246, 0.1)',
          hover: {
            background: 'rgba(243, 244, 246, 0.08)',
            transform: 'translateY(-1px)'
          }
        },
        popup: {
          background: 'rgba(42, 58, 79, 0.95)',
          backdropFilter: 'blur(8px)',
          shadow: '0 8px 32px rgba(30, 42, 56, 0.2)'
        }
      },
      black: '#1E2A38',
      white: '#ECEFF0',
    },
    light: {
      background: '#ECEFF0',
      card: {
        background: '#FFFFFF',
        border: '1px solid rgba(30, 42, 56, 0.1)',
        hoverTransform: 'hover:translate-y-[-2px]',
        accent: 'rgba(30, 42, 56, 0.05)',
        boxShadow: 'rgba(30, 42, 56, 0.1)'
      },
      text: {
        primary: '#1E2A38',
        secondary: '#2A3A4F',
        tertiary: '#4A5568',
        title: '#1E2A38',
        subtitle: '#2A3A4F',
        error: '#EC4899',
        success: '#10B981'
      },
      icon: {
        default: 'text-gray-600',
        hover: 'text-gray-900',
        accent: '#3B82F6'
      },
      nav: {
        background: '#FFFFFF',
        border: '1px solid rgba(30, 42, 56, 0.1)',
        activeColor: '#1E2A38',
        inactiveColor: 'rgba(30, 42, 56, 0.7)',
        hoverTransform: 'hover:translate-y-[-2px]',
        colors: {
          home: '#10B981',
          applications: '#3B82F6',
          companyHub: '#6D28D9',
          careerAssistant: '#EC4899',
          workers: '#3B82F6',
          blog: '#1E2A38',
          settings: '#1E2A38',
          landing: '#1E2A38',
        }
      },
      status: {
        interested: '#10B981',
        applied: '#3B82F6',
        interviewing: '#6D28D9',
        offer: '#EC4899',
        rejected: '#EC4899',
        ghosted: '#4A5568'
      },
      form: {
        input: {
          background: 'rgba(30, 42, 56, 0.02)',
          text: '#1E2A38',
          placeholder: 'rgba(30, 42, 56, 0.4)',
          border: 'rgba(30, 42, 56, 0.1)',
          focus: '#3B82F6',
          hover: {
            background: 'rgba(30, 42, 56, 0.04)',
            transform: 'translateY(-1px)',
            shadow: '0 4px 12px rgba(30, 42, 56, 0.05)'
          }
        },
        select: {
          background: 'rgba(30, 42, 56, 0.02)',
          text: '#1E2A38',
          border: 'rgba(30, 42, 56, 0.1)',
          hover: {
            background: 'rgba(30, 42, 56, 0.04)',
            transform: 'translateY(-1px)'
          }
        },
        popup: {
          background: 'rgba(243, 244, 246, 0.95)',
          backdropFilter: 'blur(8px)',
          shadow: '0 8px 32px rgba(30, 42, 56, 0.1)'
        }
      },
      black: '#1E2A38',
      white: '#ECEFF0',
    },
  };


  const utilStyles = {
    typography: {
        fontFamily: {
            // sans: 'IBM Plex Sans, sans-serif',
            sans: '',
            mono: ''
            // mono: 'Berkeley Mono, monospace'
        },
        fontSize: {
            xs: '0.75rem',     // 12px
            sm: '0.875rem',    // 14px
            base: '1rem',      // 16px
            lg: '1.125rem',    // 18px
            xl: '1.25rem',     // 20px
            '2xl': '1.5rem',   // 24px
            '3xl': '1.875rem', // 30px
            '4xl': '2.25rem',  // 36px
            '5xl': '3rem',     // 48px
        },
        lineHeight: {
            tight: '1.2',
            base: '1.5',
            relaxed: '1.75'
        },
        fontWeight: {
            normal: '400',
            medium: '500',
            semibold: '600',
            bold: '700'
        }
    },
    icon: {
        size: {
            xs: '0.75rem',     // 12px - for very small indicators
            sm: '1rem',        // 16px - for inline text icons
            base: '1.25rem',   // 20px - default icon size
            lg: '1.5rem',      // 24px - for prominent UI elements
            xl: '2rem',        // 32px - for featured icons
            '2xl': '2.5rem',   // 40px - for hero sections
            '3xl': '3rem',     // 48px - for large displays
        },
        padding: {
            tight: '0.25rem',  // 4px - minimal padding
            base: '0.5rem',    // 8px - default padding
            relaxed: '0.75rem' // 12px - more spacious layout
        }
    },
    spacing: {
        base: '8px',
        padding: {
            xs: '0.25rem',      // 8px
            sm: '0.75rem',     // 12px
            base: '1rem',      // 16px
            md: '1.5rem',      // 24px
            lg: '2rem',        // 32px
            xl: '3rem',        // 48px
            '2xl': '4rem',     // 64px
        },
        margin: {
            xs: '0.5rem',
            sm: '0.75rem',
            base: '1rem',
            md: '1.5rem',
            lg: '2rem',
            xl: '3rem',
            '2xl': '4rem',
        },
        layout: {
            containerPadding: '1.5rem',
            sectionGap: '2rem',
            componentGap: '1rem',
            maxWidth: '1200px'
        }
    },
    effects: {
        shadow: {
            sm: '0 2px 4px 0 rgba(0, 0, 0, 0.05), 0 1px 3px 0 rgba(0, 0, 0, 0.1)',
            md: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
            lg: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)'
        },
        borderRadius: {
            sm: '0.375rem',
            md: '0.5rem',
            lg: '0.75rem',
            xl: '1rem'
        }
    },
    components: {
        card: {
            base: 'rounded-lg backdrop-blur-md transition-all duration-300',
            padding: 'p-3'
        },
        button: {
            base: 'rounded-lg px-4 py-2 font-medium backdrop-blur-sm transition-all duration-200',
            calendar: 'px-3 py-1.5 text-sm font-medium rounded-md transition-colors hover:bg-opacity-80'
        },
        input: {
            base: 'rounded-lg backdrop-blur-sm px-4 py-2 transition-all duration-200'
        },
        text: {
            heading: 'text-2xl font-semibold tracking-tight',
            subtitle: 'text-sm font-normal',
            superSubtitle: 'text-xs font-medium uppercase tracking-wider',
            logo: 'font-bold tracking-tight'
        }
    },
    layout: {
        sidebar: {
            helper: 'w-[20%] min-w-[200px] transition-all duration-200'
        },
        container: {
            dashboard: 'h-screen flex w-ful',
            landing: 'min-h-screen flex items-center justify-center p-6',
            topLayer: 'h-full w-full w-full rounded-xl'
        },
        padding: {
            consoleOpen: 'p-6 pt-20 w-full max-w-7xl mx-auto transition-all duration-200',
            consoleClosed: 'p-8 pt-20 w-full max-w-7xl mx-auto transition-all duration-200'
        },
    }
  }

  const toggleTheme = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
    localStorage.setItem('theme', newTheme);
  };

  useEffect(() => {
    const savedTheme = localStorage.getItem('theme') as 'light' | 'dark';
    if (savedTheme) {
      // setTheme(savedTheme);
      setTheme('light');
    } else {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      setTheme(prefersDark ? 'dark' : 'light');
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('theme', theme);
  }, [theme]);

  const value = {
    theme,
    toggleTheme,
    styles: styles[theme],
    utilStyles
  };

  return (
    <JobKompassThemeContext.Provider value={value}>
      {/* <div className={`transition-colors duration-300 ${theme === 'dark' ? 'dark' : ''}`}> */}
        {children}
      {/* </div> */}
    </JobKompassThemeContext.Provider>
  );
}

export const useJobKompassTheme = () => {
  const context = useContext(JobKompassThemeContext);
  if (!context) {
    throw new Error('useJobKompassTheme must be used within a JobKompassThemeProvider');
  }
  return context;
};