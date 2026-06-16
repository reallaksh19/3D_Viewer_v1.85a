import { decodeTextUtf8, baseNameWithoutExtension } from '../core/output-utils.js';

export async function run(context) {
  if (!context.workerRunner) {
    throw new Error('Python worker runtime is not available.');
  }
  const primary = context.inputFiles.find(f => f.role === 'primary');
  if (!primary || !primary.bytes) {
    throw new Error('Primary staged JSON input is required for StagedJSON -> InputXML conversion.');
  }

  const response = await context.workerRunner.runJob({
    converterId: context.converterId,
    inputFiles: context.inputFiles,
    options: context.options,
  });

  const stagedJsonPreviewText = decodeTextUtf8(primary.bytes);
  const stem = baseNameWithoutExtension(primary.name);

  const outputs = Array.isArray(response.outputs) ? response.outputs : [];
  const previewOutputs = [
    {
      name: `${stem}_managed_stage_preview.json`,
      text: stagedJsonPreviewText,
      mime: 'application/json;charset=utf-8',
    },
    ...outputs,
  ];

  return {
    ...response,
    outputs: previewOutputs,
  };
}
