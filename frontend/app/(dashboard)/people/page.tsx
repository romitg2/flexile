"use client";
import { zodResolver } from "@hookform/resolvers/zod";
import { CalendarDate, getLocalTimeZone, today } from "@internationalized/date";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { getFilteredRowModel, getSortedRowModel } from "@tanstack/react-table";
import { formatISO } from "date-fns";
import { LinkIcon, Plus, Users } from "lucide-react";
import Link from "next/link";
import React, { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { DashboardHeader } from "@/components/DashboardHeader";
import DataTable, { createColumnHelper, useTable } from "@/components/DataTable";
import DatePicker from "@/components/DatePicker";
import { MutationStatusButton } from "@/components/MutationButton";
import Placeholder from "@/components/Placeholder";
import Status from "@/components/Status";
import TableSkeleton from "@/components/TableSkeleton";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useCurrentCompany } from "@/global";
import { countries } from "@/models/constants";
import { PayRateType, trpc } from "@/trpc/client";
import { request } from "@/utils/request";
import { company_workers_path } from "@/utils/routes";
import { formatDate, serverDateToLocal } from "@/utils/time";
import { useIsMobile } from "@/utils/use-mobile";
import NewDocumentField, { schema as documentSchema } from "../documents/NewDocumentField";
import FormFields, { schema as formSchema } from "./FormFields";
import InviteLinkModal from "./InviteLinkModal";

const removeMailtoPrefix = (email: string) => email.replace(/^mailto:/iu, "");

export default function PeoplePage() {
  const company = useCurrentCompany();
  const { data: workers = [], isLoading } = trpc.contractors.list.useQuery({ companyId: company.id });
  const isMobile = useIsMobile();

  const columnHelper = createColumnHelper<(typeof workers)[number]>();
  const desktopColumns = useMemo(
    () => [
      columnHelper.accessor("user.name", {
        id: "userName",
        header: "Name",
        cell: (info) => {
          const content = info.getValue();
          return (
            <Link href={`/people/${info.row.original.user.id}`} className="after:absolute after:inset-0">
              {content}
            </Link>
          );
        },
      }),
      columnHelper.accessor("role", {
        header: "Role",
        cell: (info) => info.getValue() || "N/A",
        meta: { filterOptions: [...new Set(workers.map((worker) => worker.role))] },
      }),
      columnHelper.simple("user.countryCode", "Country", (v) => v && countries.get(v)),
      columnHelper.accessor((row) => (row.endedAt ? "Alumni" : row.startedAt > new Date() ? "Onboarding" : "Active"), {
        id: "status",
        header: "Status",
        meta: { filterOptions: ["Active", "Onboarding", "Alumni"] },
        cell: (info) =>
          info.row.original.endedAt ? (
            <Status variant="critical">Ended on {formatDate(serverDateToLocal(info.row.original.endedAt))}</Status>
          ) : info.row.original.startedAt <= new Date() ? (
            <Status variant="success">Started on {formatDate(serverDateToLocal(info.row.original.startedAt))}</Status>
          ) : info.row.original.user.onboardingCompleted ? (
            <Status variant="success">Starts on {formatDate(serverDateToLocal(info.row.original.startedAt))}</Status>
          ) : info.row.original.user.invitationAcceptedAt ? (
            <Status variant="primary">In Progress</Status>
          ) : (
            <Status variant="primary">Invited</Status>
          ),
      }),
    ],
    [workers],
  );
  const mobileColumns = useMemo(
    () => [
      columnHelper.display({
        id: "nameRoleCountry",
        cell: (info) => {
          const person = info.row.original;
          return (
            <>
              <div>
                <div className="text-base font-medium">{person.user.name}</div>
                <div className="text-sm font-normal">{person.role}</div>
              </div>
              {person.user.countryCode ? (
                <div className="text-sm font-normal text-gray-600">{countries.get(person.user.countryCode)}</div>
              ) : null}
            </>
          );
        },
        meta: {
          cellClassName: "w-full",
        },
      }),

      columnHelper.display({
        id: "statusDisplay",
        cell: (info) => {
          const original = info.row.original;
          let variant: "critical" | "success" | "primary";

          if (original.endedAt) {
            variant = "critical";
          } else if (original.startedAt <= new Date()) {
            variant = "success";
          } else if (original.user.onboardingCompleted) {
            variant = "success";
          } else if (original.user.invitationAcceptedAt) {
            variant = "primary";
          } else {
            variant = "primary";
          }

          return (
            <div className="flex h-full flex-col items-end justify-between">
              <div className="flex h-5 w-4 items-center justify-center">
                <Status variant={variant} />
              </div>
            </div>
          );
        },
      }),

      columnHelper.accessor((row) => (row.endedAt ? "Alumni" : row.startedAt > new Date() ? "Onboarding" : "Active"), {
        id: "status",
        header: "Status",
        meta: {
          filterOptions: ["Active", "Onboarding", "Alumni"],
          hidden: true,
        },
      }),

      columnHelper.accessor("user.name", {
        id: "userName",
        header: "Name",
        meta: {
          hidden: true,
        },
      }),

      columnHelper.accessor("role", {
        id: "role",
        header: "Role",
        meta: {
          filterOptions: [...new Set(workers.map((worker) => worker.role))],
          hidden: true,
        },
      }),
    ],
    [workers],
  );

  const columns = isMobile ? mobileColumns : desktopColumns;

  const table = useTable({
    columns,
    data: workers,
    initialState: {
      sorting: [{ id: "status", desc: false }],
    },
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  return (
    <>
      <DashboardHeader
        title="People"
        headerActions={
          <>
            {isMobile && table.options.enableRowSelection ? (
              <button
                className="text-blue-600"
                onClick={() => table.toggleAllRowsSelected(!table.getIsAllRowsSelected())}
              >
                {table.getIsAllRowsSelected() ? "Unselect all" : "Select all"}
              </button>
            ) : null}
            {workers.length === 0 ? <ActionPanel /> : null}
          </>
        }
      />

      {isLoading ? (
        <TableSkeleton columns={4} />
      ) : workers.length > 0 ? (
        <DataTable table={table} searchColumn="userName" tabsColumn="status" actions={<ActionPanel />} />
      ) : (
        <div className="mx-4">
          <Placeholder icon={Users}>Contractors will show up here.</Placeholder>
        </div>
      )}
    </>
  );
}

const inviteSchema = formSchema.merge(documentSchema).extend({
  email: z.string().email(),
  startDate: z.instanceof(CalendarDate),
  contractSignedElsewhere: z.boolean().default(false),
});
const ActionPanel = () => {
  const company = useCurrentCompany();
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showInviteLinkModal, setShowInviteLinkModal] = useState(false);

  const { data: workers = [], refetch } = trpc.contractors.list.useQuery({ companyId: company.id });
  const lastContractor = workers[0];
  const inviteForm = useForm({
    values: {
      email: "",
      role: lastContractor?.role ?? "",
      payRateType: lastContractor?.payRateType ?? PayRateType.Hourly,
      payRateInSubunits: lastContractor?.payRateInSubunits ?? null,
      startDate: today(getLocalTimeZone()),
      contractSignedElsewhere: lastContractor?.contractSignedElsewhere ?? false,
      contract: "",
    },
    resolver: zodResolver(inviteSchema),
  });
  const inviteMutation = useMutation({
    mutationFn: async (values: z.infer<typeof inviteSchema>) => {
      const formData = new FormData();
      formData.append("contractor[email]", values.email);
      formData.append("contractor[started_at]", formatISO(values.startDate.toDate(getLocalTimeZone())));
      formData.append("contractor[pay_rate_in_subunits]", values.payRateInSubunits?.toString() ?? "");
      formData.append(
        "contractor[pay_rate_type]",
        values.payRateType === PayRateType.Hourly ? "hourly" : "project_based",
      );
      formData.append("contractor[role]", values.role);
      formData.append("contractor[contract_signed_elsewhere]", values.contractSignedElsewhere.toString());
      formData.append("contractor[contract]", values.contract);

      const response = await request({
        url: company_workers_path(company.id),
        method: "POST",
        accept: "json",
        assertOk: true,
        formData,
      });

      if (!response.ok) {
        const json = z.object({ error_message: z.string() }).parse(await response.json());
        throw new Error(json.error_message);
      }
    },
    onSuccess: async () => {
      await refetch();
      setShowInviteModal(false);
      inviteForm.reset();
      await queryClient.invalidateQueries({ queryKey: ["currentUser"] });
    },
  });
  const submit = inviteForm.handleSubmit((values) => inviteMutation.mutate(values));

  return (
    <>
      {isMobile ? (
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="floating-action">
              <Plus />
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogTitle>Invite people to your workspace</DialogTitle>
            <DialogDescription className="sr-only">Invite people to your workspace</DialogDescription>
            <div className="flex flex-col gap-3">
              <DialogClose asChild onClick={() => setShowInviteLinkModal(true)}>
                <Button size="small" variant="outline">
                  <LinkIcon className="size-4" />
                  Invite link
                </Button>
              </DialogClose>
              <DialogClose asChild onClick={() => setShowInviteModal(true)}>
                <Button size="small">
                  <Plus className="size-4" />
                  Add contractor
                </Button>
              </DialogClose>
            </div>
          </DialogContent>
        </Dialog>
      ) : (
        <div className="flex flex-row gap-2">
          <Button size="small" variant="outline" onClick={() => setShowInviteLinkModal(true)}>
            <LinkIcon className="size-4" />
            Invite link
          </Button>
          <Button size="small" onClick={() => setShowInviteModal(true)}>
            <Plus className="size-4" />
            Add contractor
          </Button>
        </div>
      )}
      <Dialog open={showInviteModal} onOpenChange={setShowInviteModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Who's joining?</DialogTitle>
          </DialogHeader>
          <Form {...inviteForm}>
            <form onSubmit={(e) => void submit(e)} className="space-y-4">
              <FormField
                control={inviteForm.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        type="email"
                        placeholder="Contractor's email"
                        onChange={(e) => field.onChange(removeMailtoPrefix(e.target.value))}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={inviteForm.control}
                name="startDate"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <DatePicker {...field} label="Start date" granularity="day" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormFields />

              <FormField
                control={inviteForm.control}
                name="contractSignedElsewhere"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        label="Already signed contract elsewhere"
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              {!inviteForm.watch("contractSignedElsewhere") && <NewDocumentField type="consulting_contract" />}
              <div className="flex flex-col items-end space-y-2">
                <MutationStatusButton mutation={inviteMutation} type="submit" size="small">
                  Send invite
                </MutationStatusButton>
                {inviteMutation.isError ? <div className="text-red text-sm">{inviteMutation.error.message}</div> : null}
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
      <InviteLinkModal open={showInviteLinkModal} onOpenChange={setShowInviteLinkModal} />
    </>
  );
};
