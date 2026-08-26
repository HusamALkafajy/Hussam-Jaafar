import { Skeleton } from "../../../components/ui/skeleton";
import { Container } from "../../../components/ui/container";
import { Stack } from "../../../components/ui/stack";
import { Grid } from "../../../components/ui/grid";
import { PageHeader, PageHeaderHeading, PageHeaderDescription } from "../../../components/ui/page-header";

export default function NotesLoading() {
  return (
    <Container size="xl" className="py-8">
      <Stack gap={8}>
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <PageHeader className="pb-0 border-0">
            <PageHeaderHeading>My Notes</PageHeaderHeading>
            <PageHeaderDescription>Capture your thoughts and summarize your learning.</PageHeaderDescription>
          </PageHeader>
          <div className="flex items-center gap-3">
            <Skeleton className="h-10 w-full md:w-64" />
            <Skeleton className="h-10 w-10 shrink-0" />
            <Skeleton className="h-10 w-32 shrink-0" />
          </div>
        </div>

        {/* Filters Skeleton */}
        <div className="flex gap-2 border-b pb-4">
          <Skeleton className="h-8 w-24 rounded-full" />
          <Skeleton className="h-8 w-24 rounded-full" />
          <Skeleton className="h-8 w-24 rounded-full" />
        </div>

        <Stack gap={8}>
          <Stack gap={4}>
            <Skeleton className="h-5 w-24" />
            <Grid cols={1} gap={4}>
              {[...Array(6)].map((_, i) => (
                <div key={i} className="flex flex-col h-[200px] border rounded-xl overflow-hidden bg-card">
                  <div className="p-5 flex-1 flex flex-col gap-3">
                    <div className="flex items-start justify-between gap-4">
                      <Skeleton className="h-6 w-3/4" />
                      <Skeleton className="h-4 w-4 shrink-0" />
                    </div>
                    <Stack gap={2} className="mt-2">
                      <Skeleton className="h-4 w-full" />
                      <Skeleton className="h-4 w-full" />
                      <Skeleton className="h-4 w-2/3" />
                    </Stack>
                  </div>
                  <div className="px-5 py-3 border-t bg-muted/20 flex justify-between">
                    <Skeleton className="h-3 w-32" />
                  </div>
                </div>
              ))}
            </Grid>
          </Stack>
        </Stack>
      </Stack>
    </Container>
  );
}
