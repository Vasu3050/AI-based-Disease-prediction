import { loadModels } from '../ml/registry';
import { ModelVersion } from '../models/ModelVersion';
import { logger } from '../utils/logger';

/**
 * Upsert the trained model artifacts known to the registry into the
 * `modelVersions` collection, so admins can see what is deployed.
 */
export async function syncModelVersionsToDb(): Promise<number> {
  const { artifacts } = loadModels();
  let synced = 0;
  for (const a of artifacts) {
    await ModelVersion.updateOne(
      { key: a.key },
      {
        $set: {
          name: a.name,
          targetId: a.targetId,
          title: a.title,
          version: a.version,
          trainedAt: new Date(a.trainedAt),
          active: true,
          metrics: a.metrics,
          dataset: a.dataset,
          features: a.features,
        },
      },
      { upsert: true }
    );
    synced += 1;
  }
  if (synced > 0) logger.info(`Synced ${synced} model version(s) to database`);
  return synced;
}
