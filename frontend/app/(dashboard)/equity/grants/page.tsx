"use client";
import { useQuery } from "@tanstack/react-query";
import { CircleAlert, CircleCheck, Info, Plus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { useDocumentTemplateQuery } from "@/app/(dashboard)/documents";
import NewEquityGrantModal from "@/app/(dashboard)/equity/grants/NewEquityGrantModal";
import { DashboardHeader } from "@/components/DashboardHeader";
import DataTable, { createColumnHelper, useTable } from "@/components/DataTable";
import { linkClasses } from "@/components/Link";
import MutationButton from "@/components/MutationButton";
import Placeholder from "@/components/Placeholder";
import TableSkeleton from "@/components/TableSkeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useCurrentCompany, useCurrentUser } from "@/global";
import type { RouterOutput } from "@/trpc";
import { trpc } from "@/trpc/client";
import { formatMoney } from "@/utils/formatMoney";
import { formatDate } from "@/utils/time";
import { useIsMobile } from "@/utils/use-mobile";

type EquityGrant = RouterOutput["equityGrants"]["list"][number];
export default function GrantsPage() {
  const isMobile = useIsMobile();
  const router = useRouter();
  const user = useCurrentUser();
  const company = useCurrentCompany();
  const { data = [], isLoading, refetch } = trpc.equityGrants.list.useQuery({ companyId: company.id });
  const [cancellingGrantId, setCancellingGrantId] = useState<string | null>(null);
  const [showNewGrantModal, setShowNewGrantModal] = useState(false);
  const cancellingGrant = data.find((grant) => grant.id === cancellingGrantId);
  const cancelGrant = trpc.equityGrants.cancel.useMutation({
    onSuccess: () => {
      setCancellingGrantId(null);
      void refetch();
    },
  });

  const exerciseNoticeConfig = useDocumentTemplateQuery("exercise_notice");
  const { data: exerciseData } = useQuery({
    ...exerciseNoticeConfig,
    enabled: company.flags.includes("option_exercising") && !!user.roles.administrator,
  });
  const columnHelper = createColumnHelper<EquityGrant>();
  const columns = useMemo(
    () => [
      columnHelper.accessor("optionHolderName", {
        header: "Contractor",
        cell: (info) => (
          <Link href={`/people/${info.row.original.user.id}`} className="no-underline">
            {info.row.original.optionHolderName}
          </Link>
        ),
      }),
      columnHelper.simple("issuedAt", "Issue date", formatDate),
      columnHelper.simple("numberOfShares", "Granted", (v) => v.toLocaleString(), "numeric"),
      columnHelper.simple("vestedShares", "Vested", (v) => v.toLocaleString(), "numeric"),
      columnHelper.simple("unvestedShares", "Unvested", (v) => v.toLocaleString(), "numeric"),
      columnHelper.simple("exercisedShares", "Exercised", (v) => v.toLocaleString(), "numeric"),
      columnHelper.simple("exercisePriceUsd", "Exercise price", (v) => formatMoney(v, { precise: true }), "numeric"),
      columnHelper.display({
        id: "actions",
        header: "Actions",
        cell: (info) =>
          info.row.original.unvestedShares > 0 ? (
            <Button variant="critical" size="small" onClick={() => setCancellingGrantId(info.row.original.id)}>
              Cancel
            </Button>
          ) : null,
      }),
    ],
    [],
  );

  const table = useTable({ columns, data });

  return (
    <>
      <DashboardHeader
        title="Equity grants"
        headerActions={
          isMobile ? (
            <Button variant="floating-action" onClick={() => setShowNewGrantModal(true)}>
              <Plus />
            </Button>
          ) : (
            <Button size="small" onClick={() => setShowNewGrantModal(true)}>
              New grant
            </Button>
          )
        }
      />

      {exerciseData && !exerciseData.text ? (
        <Alert className="mx-4">
          <Info />
          <AlertDescription>
            Please{" "}
            <Link href="/settings/administrator/templates?edit=exercise_notice" className={linkClasses}>
              add an exercise notice
            </Link>{" "}
            so investors can exercise their options.
          </AlertDescription>
        </Alert>
      ) : null}
      {isLoading ? (
        <TableSkeleton columns={8} />
      ) : data.length > 0 ? (
        <DataTable table={table} onRowClicked={(row) => router.push(`/people/${row.user.id}`)} />
      ) : (
        <div className="mx-4">
          <Placeholder icon={CircleCheck}>There are no option grants right now.</Placeholder>
        </div>
      )}
      <Dialog open={!!cancellingGrantId} onOpenChange={() => setCancellingGrantId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel equity grant</DialogTitle>
          </DialogHeader>
          {cancellingGrant ? (
            <>
              <DialogDescription>
                Are you sure you want to cancel this equity grant for {cancellingGrant.optionHolderName}? This action
                cannot be undone.
              </DialogDescription>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h3 className="text-muted-foreground text-sm">Total options</h3>
                  <p>{cancellingGrant.numberOfShares.toLocaleString()}</p>
                </div>
                <div>
                  <h3 className="text-muted-foreground text-sm">Vested Options</h3>
                  <p className="text-sm">{cancellingGrant.vestedShares.toLocaleString()}</p>
                </div>
                <div>
                  <h3 className="text-muted-foreground text-sm">Exercised Options</h3>
                  <p className="text-sm">{cancellingGrant.exercisedShares.toLocaleString()}</p>
                </div>
                <div>
                  <h3 className="text-muted-foreground text-sm">Options to be forfeited</h3>
                  <p className="text-sm text-red-500">{cancellingGrant.unvestedShares.toLocaleString()}</p>
                </div>
              </div>
              <Alert variant="destructive">
                <CircleAlert className="size-4" />
                <AlertTitle>Important note</AlertTitle>
                <AlertDescription>
                  {cancellingGrant.unvestedShares.toLocaleString()} options will be returned to the option pool. This
                  action cannot be undone.
                </AlertDescription>
              </Alert>
              <DialogFooter>
                <Button variant="outline" size="small" onClick={() => setCancellingGrantId(null)}>
                  Cancel
                </Button>
                <MutationButton
                  idleVariant="critical"
                  size="small"
                  mutation={cancelGrant}
                  param={{ companyId: company.id, id: cancellingGrant.id, reason: "Cancelled by admin" }}
                >
                  Confirm cancellation
                </MutationButton>
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
      <NewEquityGrantModal open={showNewGrantModal} onOpenChange={setShowNewGrantModal} />
    </>
  );
}
