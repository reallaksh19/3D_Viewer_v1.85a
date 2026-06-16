# glTF Validator integration

This directory contains the project-local integration wrapper for validating generated `.glb` files with the Khronos glTF Validator.

## Upstream

- Repository: https://github.com/KhronosGroup/glTF-Validator
- License: Apache-2.0
- Runtime package used by CI: `gltf-validator`

## Vendor/copy policy

The preferred way to copy the upstream open-source repository into this repo is a Git subtree, not hand-pasted source files:

```bash
git subtree add \
  --prefix tools/gltf-validator/upstream \
  https://github.com/KhronosGroup/glTF-Validator.git \
  main \
  --squash
```

Keep upstream source outside `viewer/` so GitHub Pages does not publish validator internals as runtime application code.

## Validation flow

```text
InputXML fixture
  -> InputXML→GLB runner
  -> sample .glb artifact
  -> tools/gltf-validator/validate-glb.mjs
  -> .validation.json report
  -> CI fails when errorCount > 0
```

## Local commands

```bash
npm install --no-save three gltf-validator
node tools/gltf-validator/generate-inputxml-glb-sample.mjs
node tools/gltf-validator/validate-glb.mjs artifacts/inputxml-glb/sample-inputxml.glb
```

## Acceptance rule

A generated GLB passes the gate only when:

```text
errorCount = 0
```

Warnings, info, and hints are reported but do not fail the gate by default.
