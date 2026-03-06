import type { EmployeesResponse } from "@collectivate/api";
import { useNavigate } from "@solidjs/router";
import { BadgeCheck, Download, ListFilter, PenLine, Plus, X } from "lucide-solid";
import { createMemo, createResource, createSignal, For, Match, Show, Switch } from "solid-js";
import { Button, Input } from "~/components/form";
import Icon from "../Icon";
import "./DataTable.css";

async function fetchEmployees(companyId: string) {
  const res = await fetch(`/api/${companyId}/employees`);
  if (!res.ok)
    throw new Error(`Failed to fetch employees: ${res.status}`);
  return res.json() as Promise<EmployeesResponse[]>;
}

export default function DataTable(props: { companyId: string }) {
  const navigate = useNavigate();
  const [employeeData] = createResource(() => props.companyId, fetchEmployees);
  const canEdit = createMemo(() => true);
  const canAttest = createMemo(() => true);
  const showTip = createMemo(() => canEdit() && true);
  const [searchInput, setSearchInput] = createSignal("");

  return (
    <div class="h-full w-full flex flex-col gap-4 p-8">
      {/* Input Row */}
      <div class="flex items-center gap-2">
        <h1 class="font-bold grow">View Staff</h1>
        {searchInput() && (
          <Button
            variant="ghost"
            onClick={() => setSearchInput("")}
          >
            <Icon icon={X} />
          </Button>
        )}
        {canEdit() && (
          <>
            <Button>
              <Icon icon={Plus} />
              Add Staff
            </Button>
            <Button variant="outline">
              <Icon icon={PenLine} />
              Bulk Edit
            </Button>
          </>
        )}
        <Button variant="outline">
          <Icon icon={Download} />
          Export CSV
        </Button>
        {canAttest()
          && (
            <Button variant="outline">
              <Icon icon={BadgeCheck} />
              Attest Data
            </Button>
          )}
      </div>

      {showTip() && (
        <div class="flex items-center bg-gray-50 p-2 pl-3 rounded-lg border border-gray-200">
          <span class="grow text-sm text-gray-600">
            <strong>💡 Tip: </strong>
            Need to edit multiple rows without clicking on each one? Try the
            <strong> Bulk Edit </strong>
            mode above to make changes to multiple data records at once!
          </span>
          <Button variant="ghost" size="fill" square onClick={() => {}}>
            <Icon icon={X} />
          </Button>
        </div>
      )}

      <div class="flex flex-col border rounded">
        <div class="flex items-center gap-2 p-2">
          <Button variant="outline">
            <Icon icon={ListFilter} />
            Filters
          </Button>

          <span class="status-pill" data-status="active">Active</span>

          <div class="grow" />
          <Button variant="outline">
            Clear Filters
          </Button>
          <Input
            placeholder="Search table..."
            value={searchInput()}
            onChange={e => setSearchInput(e.target.value)}
          />
        </div>
        <table>
          <thead>
            <tr>
              <th>First Name</th>
              <th>Last Name</th>
              <th>Email</th>
              <th>Base Salary</th>
              <th>Start Date</th>
              <th>Job Category</th>
              <th>Hot List</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            <Switch>
              <Match when={employeeData.loading}>
                <tr><td colSpan={8}>Loading...</td></tr>
              </Match>
              <Match when={employeeData.error}>
                <tr class="error"><td colSpan={8}>Failed to load employees.</td></tr>
              </Match>
              <Match when={employeeData()?.data.length === 0}>
                <tr><td colSpan={8}>No employees found.</td></tr>
              </Match>
              <Match when={employeeData()?.data.length > 0}>
                <For each={employeeData()?.data}>
                  {employee => (
                    <tr onClick={() => navigate(`/staff/${employee.id}`)}>
                      <td>{employee.first_name}</td>
                      <td>{employee.last_name}</td>
                      <td>{employee.email ?? "—"}</td>
                      <td>{employee.base_salary != null ? `$${employee.base_salary.toLocaleString()}` : "—"}</td>
                      <td>{employee.start_date ?? "—"}</td>
                      <td>{employee.category ?? "—"}</td>
                      <td>{employee.hot_list ? "Yes" : "No"}</td>
                      <td>
                        <Show when={employee.status} fallback="—">
                          <span class="status-pill" data-status={employee.status}>
                            {readableStatus(employee.status)}
                          </span>
                        </Show>
                      </td>
                    </tr>
                  )}
                </For>
              </Match>
            </Switch>
          </tbody>
        </table>
      </div>
    </div>
  );
}

function readableStatus(status: EmployeesResponse["status"]) {
  if (status === "active")
    return "Active";
  if (status === "terminated")
    return "Terminated";
  return "Unknown";
}
