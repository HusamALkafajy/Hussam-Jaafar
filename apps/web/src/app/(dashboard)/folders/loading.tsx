import { Skeleton } from "../../../components/ui/skeleton";
import { Container } from "../../../components/ui/container";
import { Stack } from "../../../components/ui/stack";
import { Grid } from "../../../components/ui/grid";
import { PageHeader, PageHeaderHeading, PageHeaderDescription } from "../../../components/ui/page-header";

export default function FoldersLoading() {
  return (
    <Container size="xl" className="py-8">
      <Stack gap={8}>
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <PageHeader className="pb-0 border-0">
            <PageHeaderHeading>Files & Folders</PageHeaderHeading>
            <PageHeaderDescription>Organize your documents and study materials.</PageHeaderDescription>
          </PageHeader>
          <div className="flex items-center gap-3">
            <Skeleton className="h-10 w-full md:w-64" />
            <Skeleton className="h-10 w-32 shrink-0" />
            <Skeleton className="h-10 w-32 shrink-0" />
          </div>
        </div>

        <div className="bg-muted/30 p-3 rounded-lg border">
          <Skeleton className="h-6 w-48" />
        </div>

        <Stack gap={6}>
          <Stack gap={4}>
            <Skeleton className="h-5 w-24" />
            <Grid cols={1} gap={4}>
              {[...Array(4)].map((_, i) => (
                <Skeleton key={i} className="h-20 w-full" />
              ))}
            </Grid>
          </Stack>

          <Stack gap={4}>
            <Skeleton className="h-5 w-24" />
            <div className="flex flex-col gap-2">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          </Stack>
        </Stack>
      </Stack>
    </Container>
  );
}
