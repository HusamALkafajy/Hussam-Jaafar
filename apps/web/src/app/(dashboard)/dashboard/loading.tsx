import { Skeleton } from "../../../components/ui/skeleton";
import { Container } from "../../../components/ui/container";
import { Grid } from "../../../components/ui/grid";
import { Stack } from "../../../components/ui/stack";
import { Surface } from "../../../components/ui/surface";

export default function DashboardLoading() {
  return (
    <Container size="xl" className="py-8">
      <Stack gap={8}>
        {/* Welcome Section Skeleton */}
        <Surface variant="glass" className="p-6 md:p-8 flex flex-col md:flex-row items-center justify-between gap-6 border-primary/20">
          <Stack gap={3} className="text-center md:text-start flex-1 w-full">
            <Skeleton className="h-8 w-64 md:w-96" />
            <Skeleton className="h-4 w-48" />
          </Stack>
          <Skeleton className="h-24 w-full md:w-48 shrink-0 rounded-xl" />
        </Surface>

        {/* Overview Stats Skeleton */}
        <Grid cols={1} gap={4}>
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </Grid>

        <Grid cols={1} gap={8}>
          {/* Main Content Column Skeleton */}
          <Stack gap={8} className="lg:col-span-2">
            <Stack gap={4}>
              <div className="flex items-center justify-between">
                <Skeleton className="h-6 w-32" />
              </div>
              <Grid cols={1} gap={4}>
                {[...Array(4)].map((_, i) => (
                  <Skeleton key={i} className="h-28 w-full" />
                ))}
              </Grid>
            </Stack>

            <Stack gap={4}>
              <div className="flex items-center justify-between">
                <Skeleton className="h-6 w-40" />
                <Skeleton className="h-4 w-20" />
              </div>
              <Grid cols={1} gap={4}>
                {[...Array(3)].map((_, i) => (
                  <Skeleton key={i} className="h-32 w-full" />
                ))}
              </Grid>
            </Stack>
          </Stack>

          {/* Sidebar Column Skeleton */}
          <Stack gap={8}>
            <Skeleton className="h-48 w-full" />
            <Skeleton className="h-64 w-full" />
            <Skeleton className="h-48 w-full" />
          </Stack>
        </Grid>
      </Stack>
    </Container>
  );
}
