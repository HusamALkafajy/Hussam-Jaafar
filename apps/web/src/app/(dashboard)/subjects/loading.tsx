import { Skeleton } from "../../../components/ui/skeleton";
import { Container } from "../../../components/ui/container";
import { Stack } from "../../../components/ui/stack";
import { Grid } from "../../../components/ui/grid";
import { PageHeader, PageHeaderHeading, PageHeaderDescription } from "../../../components/ui/page-header";

export default function SubjectsLoading() {
  return (
    <Container size="xl" className="py-8">
      <Stack gap={8}>
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <PageHeader className="pb-0 border-0">
            <PageHeaderHeading>Subjects</PageHeaderHeading>
            <PageHeaderDescription>Manage and organize your study materials by subject.</PageHeaderDescription>
          </PageHeader>
          <div className="flex items-center gap-3">
            <Skeleton className="h-10 w-full md:w-64" />
            <Skeleton className="h-10 w-20 shrink-0" />
            <Skeleton className="h-10 w-32 shrink-0" />
          </div>
        </div>

        <Grid cols={1} gap={6}>
          {[...Array(8)].map((_, i) => (
            <div key={i} className="flex flex-col h-[200px] border rounded-xl overflow-hidden bg-card">
              <div className="p-6 flex-1 flex flex-col gap-4">
                <div className="flex items-start justify-between">
                  <Skeleton className="h-12 w-12 rounded-lg" />
                  <Skeleton className="h-8 w-8 rounded-md" />
                </div>
                <div>
                  <Skeleton className="h-6 w-3/4 mb-2" />
                  <Skeleton className="h-4 w-1/2" />
                </div>
              </div>
              <div className="px-6 py-3 border-t bg-muted/20">
                <Skeleton className="h-3 w-2/3" />
              </div>
            </div>
          ))}
        </Grid>
      </Stack>
    </Container>
  );
}
