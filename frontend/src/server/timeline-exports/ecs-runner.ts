import 'server-only';

import { ECSClient, RunTaskCommand, type Failure } from '@aws-sdk/client-ecs';

const DEFAULT_TIMELINE_EXPORT_ECS_CONTAINER_NAME = 'timeline-export-worker';

const REQUIRED_ENV = [
  'TIMELINE_EXPORT_ECS_CLUSTER',
  'TIMELINE_EXPORT_ECS_TASK_DEFINITION',
  'TIMELINE_EXPORT_ECS_SUBNETS',
  'TIMELINE_EXPORT_ECS_SECURITY_GROUP',
  'TIMELINE_EXPORT_ECS_REGION',
] as const;

type TimelineExportEcsEnvKey = (typeof REQUIRED_ENV)[number];

type TimelineExportEcsConfig = {
  cluster: string;
  taskDefinition: string;
  region: string;
  subnets: string[];
  securityGroups: string[];
  containerName: string;
};

export type TimelineExportWorkerLaunchResult =
  | {
      status: 'skipped';
      reason: 'test_environment';
    }
  | {
      status: 'launched';
      taskArns: string[];
    };

function splitCsv(value: string, label: string): string[] {
  const items = value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
  if (!items.length) throw new Error(`MISSING_${label}`);
  return items;
}

function readTimelineExportEcsConfig(env: NodeJS.ProcessEnv = process.env): TimelineExportEcsConfig {
  const missingKeys = REQUIRED_ENV.filter((key) => !env[key]?.trim());
  if (missingKeys.length) throw new Error(`MISSING_${missingKeys.join(',')}`);
  const readRequiredEnv = (key: TimelineExportEcsEnvKey) => String(env[key]).trim();
  return {
    cluster: readRequiredEnv('TIMELINE_EXPORT_ECS_CLUSTER'),
    taskDefinition: readRequiredEnv('TIMELINE_EXPORT_ECS_TASK_DEFINITION'),
    region: readRequiredEnv('TIMELINE_EXPORT_ECS_REGION'),
    subnets: splitCsv(readRequiredEnv('TIMELINE_EXPORT_ECS_SUBNETS'), 'TIMELINE_EXPORT_ECS_SUBNETS'),
    securityGroups: splitCsv(readRequiredEnv('TIMELINE_EXPORT_ECS_SECURITY_GROUP'), 'TIMELINE_EXPORT_ECS_SECURITY_GROUP'),
    containerName:
      env.TIMELINE_EXPORT_ECS_CONTAINER_NAME?.trim() || DEFAULT_TIMELINE_EXPORT_ECS_CONTAINER_NAME,
  };
}

export function assertTimelineExportWorkerLauncherConfigured(env: NodeJS.ProcessEnv = process.env): void {
  readTimelineExportEcsConfig(env);
}

function ecsFailureMessage(failures: Failure[]): string {
  return failures
    .map((failure) => [failure.arn, failure.reason, failure.detail].filter(Boolean).join(': '))
    .filter(Boolean)
    .join('; ');
}

export async function launchTimelineExportWorkerTask(params: {
  exportId: string;
  env?: NodeJS.ProcessEnv;
}): Promise<TimelineExportWorkerLaunchResult> {
  const env = params.env ?? process.env;
  if (env.NODE_ENV === 'test') return { status: 'skipped', reason: 'test_environment' };

  const config = readTimelineExportEcsConfig(env);
  const client = new ECSClient({ region: config.region });
  const response = await client.send(
    new RunTaskCommand({
      cluster: config.cluster,
      taskDefinition: config.taskDefinition,
      launchType: 'FARGATE',
      count: 1,
      startedBy: `timeline-export:${params.exportId}`.slice(0, 36),
      group: 'maxvideoai-timeline-export',
      overrides: {
        containerOverrides: [
          {
            name: config.containerName,
            environment: [{ name: 'TIMELINE_EXPORT_TARGET_ID', value: params.exportId }],
          },
        ],
      },
      networkConfiguration: {
        awsvpcConfiguration: {
          assignPublicIp: 'ENABLED',
          subnets: config.subnets,
          securityGroups: config.securityGroups,
        },
      },
      tags: [
        { key: 'app', value: 'maxvideoai' },
        { key: 'surface', value: 'timeline-export' },
        { key: 'exportId', value: params.exportId },
      ],
    })
  );

  if (response.failures?.length) {
    throw new Error(`TIMELINE_EXPORT_ECS_RUN_TASK_FAILED: ${ecsFailureMessage(response.failures)}`);
  }

  const taskArns = (response.tasks ?? []).map((task) => task.taskArn).filter((arn): arn is string => Boolean(arn));
  if (!taskArns.length) throw new Error('TIMELINE_EXPORT_ECS_RUN_TASK_EMPTY');
  return { status: 'launched', taskArns };
}
