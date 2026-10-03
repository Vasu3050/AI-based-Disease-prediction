/**
 * Central metadata for all datasets used to train MediPredict AI models.
 * Used by both the fetch pipeline and the training pipeline so that every
 * model artifact carries correct provenance.
 */
export const DATASETS_META = {
  pima: {
    name: 'PIMA Indians Diabetes Database',
    source:
      'Originally from the National Institute of Diabetes and Digestive and Kidney Diseases (NIDDK); distributed via widely mirrored public copies (jbrownlee/Datasets, plotly/datasets).',
    url: 'https://raw.githubusercontent.com/jbrownlee/Datasets/master/pima-indians-diabetes.data.csv',
    license: 'Public research dataset, commonly distributed as CC0 / public domain via mirrors.',
    limitations: [
      'Population: Pima Indian women aged 21+ — NOT representative of the general population.',
      'The "Glucose" field is a 2-hour oral glucose tolerance test value, not a fasting glucose.',
      'Some fields contain implausible zeros (recorded as missing during preprocessing).',
    ],
  },
  ilpd: {
    name: 'Indian Liver Patient Dataset (ILPD)',
    source: 'UCI Machine Learning Repository (dataset 225).',
    url: 'https://archive.ics.uci.edu/dataset/225/ilpd+indian+liver+patient+dataset',
    license: 'CC BY 4.0 (UCI Machine Learning Repository).',
    limitations: [
      'Contains a single "liver patient" selector label, not a specific disease diagnosis.',
      'Small dataset (583 rows) with some extreme laboratory outliers.',
      'Population: patients from Andhra Pradesh, India — generalisation is limited.',
    ],
  },
  ckd: {
    name: 'Chronic Kidney Disease dataset',
    source: 'UCI Machine Learning Repository (dataset 336).',
    url: 'https://archive.ics.uci.edu/dataset/336/chronic+kidney+disease',
    license: 'CC BY 4.0 (UCI Machine Learning Repository).',
    limitations: [
      'The "blood urea" (bu) field is mapped to BUN — a small semantic caveat (see docs/ML.md).',
      'Dataset is small (400 rows) with many missing values; only complete rows for the used features are kept.',
      'Population: single hospital cohort — generalisation is limited.',
    ],
  },
};
