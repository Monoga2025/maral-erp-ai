export interface StartupPolicy {
  seed: boolean;
  backgroundJobs: boolean;
}

export function getStartupPolicy(
  environment: Record<string, string | undefined>
): StartupPolicy {
  return {
    seed: environment.STARTUP_SEED_ENABLED !== 'false',
    backgroundJobs: environment.BACKGROUND_JOBS_ENABLED !== 'false',
  };
}
