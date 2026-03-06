import type { EmployeeUpdatesResponse } from "@collectivate/api";
import { useNavigate, useParams } from "@solidjs/router";
import { ArrowLeft } from "lucide-solid";
import { createMemo, createResource } from "solid-js";
import { Button } from "~/components/form";
import Icon from "~/components/Icon";

async function fetchEmployeeUpdates() {
  const params = useParams();
  const company_id = 1;
  const res = await fetch(`/api/${company_id}/employees/${params.employee_id}/updates`);
  if (!res.ok)
    throw new Error(`Failed to fetch employees: ${res.status}`);
  return res.json() as Promise<EmployeeUpdatesResponse[]>;
}

export default function EditEmployeePage() {
  const navigate = useNavigate();
  const [employeeUpdates] = createResource(() => 1 as any, fetchEmployeeUpdates);
  const canEdit = createMemo(() => true);
  return (
    <div class="p-8">
      <div class="flex items-center gap-2">
        <Button variant="outline" onClick={() => navigate("/staff")}>
          <Icon icon={ArrowLeft} />
          Back
        </Button>
      </div>
      <h1 class="text-2xl font-bold">Edit Employee</h1>

      <code>{JSON.stringify(employeeUpdates(), null, 2)}</code>
    </div>
  );
}
