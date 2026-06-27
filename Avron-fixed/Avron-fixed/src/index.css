@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');

@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  * {
    @apply border-slate-200 dark:border-slate-700;
  }

  body {
    @apply bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100;
    font-family: 'Inter', system-ui, sans-serif;
    -webkit-font-smoothing: antialiased;
  }

  ::-webkit-scrollbar {
    @apply w-1.5 h-1.5;
  }
  ::-webkit-scrollbar-track {
    @apply bg-transparent;
  }
  ::-webkit-scrollbar-thumb {
    @apply bg-slate-300 dark:bg-slate-600 rounded-full;
  }
  ::-webkit-scrollbar-thumb:hover {
    @apply bg-slate-400 dark:bg-slate-500;
  }
}

@layer components {
  .btn-primary {
    @apply inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium
           bg-brand-blue-600 hover:bg-brand-blue-700 active:bg-brand-blue-800
           text-white rounded-lg transition-all duration-150
           focus:outline-none focus:ring-2 focus:ring-brand-blue-500 focus:ring-offset-2
           disabled:opacity-50 disabled:cursor-not-allowed;
  }

  .btn-secondary {
    @apply inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium
           bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700
           text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-600
           rounded-lg transition-all duration-150
           focus:outline-none focus:ring-2 focus:ring-slate-300 focus:ring-offset-2
           disabled:opacity-50 disabled:cursor-not-allowed;
  }

  .btn-danger {
    @apply inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium
           bg-brand-red-600 hover:bg-brand-red-700 active:bg-brand-red-800
           text-white rounded-lg transition-all duration-150
           focus:outline-none focus:ring-2 focus:ring-brand-red-500 focus:ring-offset-2
           disabled:opacity-50 disabled:cursor-not-allowed;
  }

  .input-field {
    @apply block w-full px-3.5 py-2.5 text-sm
           bg-white dark:bg-slate-800
           border border-slate-200 dark:border-slate-600
           text-slate-900 dark:text-slate-100
           placeholder-slate-400 dark:placeholder-slate-500
           rounded-lg transition-all duration-150
           focus:outline-none focus:ring-2 focus:ring-brand-blue-500 focus:border-brand-blue-500
           disabled:bg-slate-50 dark:disabled:bg-slate-900 disabled:opacity-70;
  }

  .card {
    @apply bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 shadow-card;
  }

  .stat-card {
    @apply card p-5 hover:shadow-card-md transition-shadow duration-200;
  }

  .badge {
    @apply inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium;
  }

  .sidebar-item {
    @apply flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium
           text-slate-400 hover:text-white hover:bg-white/10
           transition-all duration-150 cursor-pointer;
  }

  .sidebar-item-active {
    @apply text-white bg-brand-blue-600 shadow-lg;
  }

  .page-header {
    @apply flex items-center justify-between mb-6;
  }

  .page-title {
    @apply text-xl font-semibold text-slate-900 dark:text-slate-100;
  }

  .table-header {
    @apply bg-slate-50 dark:bg-slate-700/50 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider;
  }

  .table-row {
    @apply border-b border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors duration-100;
  }

  .table-cell {
    @apply px-4 py-3 text-sm text-slate-700 dark:text-slate-300;
  }
}
