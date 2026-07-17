import { Skeleton } from "../../../components/ui/skeleton";
import { Container } from "../../../components/ui/container";
import { Stack } from "../../../components/ui/stack";
import { Grid } from "../../../components/ui/grid";
import { PageHeader, PageHeaderHeading, PageHeaderDescription } from "../../../components/ui/page-header";

export default function UploadLoading() {
  return (
    <Container size="xl" className="py-8">
      <Stack gap={8}>
        <PageHeader className="pb-0 border-0">
          <PageHeaderHeading>Upload Materials</PageHeaderHeading>
          <PageHeaderDescription>Add new documents, notes, or media to your workspace for AI processing.</PageHeaderDescription>
        </PageHeader>

        <Grid cols={1} gap={8}>
          <Stack gap={6} className="lg:col-span-2">
            <Skeleton className="h-[400px] w-full rounded-xl" />
          </Stack>

          <Stack gap={4}>
            <Skeleton className="h-5 w-32" />
            <div className="flex flex-col gap-3">
              {[...Array(4)].map((_, i) => (
                <Skeleton key={i} className="h-20 w-full" />
              ))}
            </div>
          </Stack>
        </Grid>
      </Stack>
    </Container>
  );
}
