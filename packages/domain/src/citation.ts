export interface ImmutableCitation {
  readonly documentId: string;
  readonly chapterId: string | null;
  readonly sectionId: string | null;
  readonly headingId: string | null;
  readonly nodeId: string;
  readonly offsetStart: number | null;
  readonly offsetEnd: number | null;
}
