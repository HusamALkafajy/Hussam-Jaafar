export interface DocumentOutlineNode {
  id: string;
  title: string;
  level: number;
  nodeId: string; // Maps to Canonical Document Node ID
  children?: DocumentOutlineNode[];
}

export const MOCK_DOCUMENT_OUTLINE: DocumentOutlineNode[] = [
  {
    id: 'out_1',
    title: 'Chapter 1: Introduction to Molecular Biology',
    level: 1,
    nodeId: 'node_1',
    children: [
      {
        id: 'out_1_1',
        title: '1.1 The Central Dogma',
        level: 2,
        nodeId: 'node_5',
      },
      {
        id: 'out_1_2',
        title: '1.2 DNA Structure',
        level: 2,
        nodeId: 'node_12',
      }
    ]
  },
  {
    id: 'out_2',
    title: 'Chapter 2: Cellular Respiration',
    level: 1,
    nodeId: 'node_25',
    children: [
      {
        id: 'out_2_1',
        title: '2.1 Glycolysis',
        level: 2,
        nodeId: 'node_28',
      },
      {
        id: 'out_2_2',
        title: '2.2 The Krebs Cycle',
        level: 2,
        nodeId: 'node_42',
      }
    ]
  }
];
