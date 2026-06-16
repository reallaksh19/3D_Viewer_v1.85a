export async function run(context) {
  if (!context.workerRunner) {
    throw new Error('Python worker runtime is not available.');
  }
  const primary = context.inputFiles.find(f => f.role === 'primary');
  if (!primary || !primary.bytes) {
    throw new Error('Primary input file is required for this converter.');
  }
  
  const inputFiles = context.inputFiles.map(file => ({
    name: file.name,
    bytes: file.bytes
  }));

  const response = await context.workerRunner.runJob({
    converterId: context.converterId,
    inputFiles,
    options: context.options
  });

  return response;
}
