/**
 * 3DV_MockData.js
 * Test dataset: 5 components with pre-populated fixingAction strings.
 * Covers: INSERT PIPE (de-dup), TRIM (Endpoint 2), SNAP (midpoint), ELBOW (no action).
 * Use this to test the PCF Builder independently of the validator pipeline.
 */

export const MOCK_COMPONENTS_WITH_FIXES = [
    {
        id: 'mock-1',
        type: 'PIPE',
        bore: 273,
        fixingAction: [
            'INSERT PIPE: Fill 550.00mm gap',
            '  New component: PIPE',
            '  EP1: (1000.00, 0.00, 0.00)',
            '  EP2: (1550.00, 0.00, 0.00)',
            '  Length: 550.00mm, Bore: 273.00mm',
        ].join('\n'),
        points: [
            { x: 0, y: 0, z: 0, bore: 273 },
            { x: 1000, y: 0, z: 0, bore: 273 },
        ],
        centrePoint: null, branch1Point: null, coOrds: null,
        attributes: { 'PIPELINE-REFERENCE': 'LINE-100' },
    },
    {
        id: 'mock-2',
        type: 'PIPE',
        bore: 273,
        // Same fixingAction text as mock-1 → will be de-duplicated (no second insert)
        fixingAction: [
            'INSERT PIPE: Fill 550.00mm gap',
            '  New component: PIPE',
            '  EP1: (1000.00, 0.00, 0.00)',
            '  EP2: (1550.00, 0.00, 0.00)',
            '  Length: 550.00mm, Bore: 273.00mm',
        ].join('\n'),
        points: [
            { x: 1550, y: 0, z: 0, bore: 273 },
            { x: 2500, y: 0, z: 0, bore: 273 },
        ],
        centrePoint: null, branch1Point: null, coOrds: null,
        attributes: { 'PIPELINE-REFERENCE': 'LINE-100' },
    },
    {
        id: 'mock-3',
        type: 'ELBOW',
        bore: 273,
        fixingAction: '',  // No action — pass-through
        points: [
            { x: 2500, y: 0, z: 0, bore: 273 },
            { x: 2500, y: 1000, z: 0, bore: 273 },
        ],
        centrePoint: { x: 2500, y: 500, z: 0 },
        branch1Point: null, coOrds: null,
        attributes: { 'SKEY': 'ELB9090' },
    },
    {
        id: 'mock-4',
        type: 'PIPE',
        bore: 273,
        fixingAction: [
            'TRIM: Reduce PIPE by 25.50mm',
            '  Endpoint 2: Move to intersection',
            '  New coord: (2500.00, 975.00, 0.00)',
            '  Overlap with PIPE resolved',
        ].join('\n'),
        points: [
            { x: 2500, y: 1000, z: 0, bore: 273 },
            { x: 2500, y: 2000, z: 0, bore: 273 },
        ],
        centrePoint: null, branch1Point: null, coOrds: null,
        attributes: {},
    },
    {
        id: 'mock-5',
        type: 'PIPE',
        bore: 273,
        fixingAction: [
            'SNAP: Merge endpoints to midpoint',
            '  PIPE EP2: Move 3.50mm → (3001.75, 0.00, 0.00)',
            '  PIPE EP1: Move 3.50mm → (3001.75, 0.00, 0.00)',
        ].join('\n'),
        points: [
            { x: 2600, y: 0, z: 0, bore: 273 },
            { x: 3000, y: 0, z: 0, bore: 273 },
        ],
        centrePoint: null, branch1Point: null, coOrds: null,
        attributes: {},
    },
];
