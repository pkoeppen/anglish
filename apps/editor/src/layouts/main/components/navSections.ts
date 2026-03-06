import type { Component } from "solid-js";
import * as Icons from "lucide-solid";

export interface NavItem {
  to: string;
  icon: Component<{ "size"?: number; "stroke-width"?: number; "class"?: string }>;
  text: string;
  badge?: number;
  isExternal?: boolean;
}

export interface NavSectionDef {
  title: string;
  items: NavItem[];
}

export const NAV_SECTIONS: NavSectionDef[] = [
  {
    title: "Data",
    items: [
      { to: "/staff", icon: Icons.Users, text: "Staff" },
      { to: "/clients", icon: Icons.Building2, text: "Clients" },
      { to: "/attestation-history", icon: Icons.History, text: "Attestation History" },
      { to: "/dashboard", icon: Icons.LayoutDashboard, text: "KPI Dashboard" },
      { to: "/nps-survey-dashboard", icon: Icons.SmilePlus, text: "eNPS Survey" },
    ],
  },
  {
    title: "Billing",
    items: [
      { to: "/add", icon: Icons.SquarePlus, text: "Add Line Items" },
      { to: "/pending-approvals", icon: Icons.SquareCheckBig, text: "Pending Approvals" },
      { to: "/templates", icon: Icons.Bookmark, text: "Templates" },
      { to: "/upload-items", icon: Icons.Upload, text: "Upload Line Items" },
      { to: "/billing-items", icon: Icons.ReceiptText, text: "View Line Items" },
      { to: "/schedule-a", icon: Icons.Calendar, text: "Schedule A" },
      { to: "/generate-invoices", icon: Icons.FileSpreadsheet, text: "Generate Invoices" },
      { to: "/management-fees", icon: Icons.CircleDollarSign, text: "Management Fees" },
      { to: "/fee-metrics", icon: Icons.BarChart, text: "Addendum Fee Data" },
    ],
  },
  {
    title: "Manage",
    items: [
      { to: "/guide", icon: Icons.LibraryBig, text: "Guide" },
      { to: "/support", icon: Icons.LifeBuoy, text: "Support" },
      { to: "/settings", icon: Icons.Settings, text: "Settings" },
    ],
  },
];
