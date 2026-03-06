import type { NavSectionDef } from "./navSections";
import { A, useLocation } from "@solidjs/router";
import * as Icons from "lucide-solid";
import { createEffect, createSignal, For, onCleanup, Show } from "solid-js";
import { NAV_SECTIONS } from "./navSections";
import SidebarUserInfo from "./SidebarUserInfo";

export default function Sidebar() {
  const [isOpen, setIsOpen] = createSignal(false);
  const [isCollapsed, setIsCollapsed] = createSignal(false);
  const isLargeScreen = createMediaQuery("(min-width: 1024px)");
  const location = useLocation();

  const collapsed = () => (isLargeScreen() ? isCollapsed() : false);

  createEffect(() => {
    if (!isLargeScreen() && isCollapsed()) {
      setIsCollapsed(false);
    }
  });

  createEffect(() => {
    if (!isLargeScreen()) {
      // Close mobile sidebar on route change
      location.pathname; // eslint-disable-line ts/no-unused-expressions
      setIsOpen(false);
    }
  });

  return (
    <>
      <HamburgerButton isOpen={isOpen()} onToggle={() => setIsOpen(v => !v)} />

      <aside
        class={`
          fixed inset-y-0 left-0 z-50 bg-gray-50 border-r border-gray-200
          transform transition-all duration-200 ease-[cubic-bezier(0.32,0.72,0,1)]
          ${isOpen() ? "translate-x-0" : "-translate-x-full"}
          ${collapsed() ? "w-16" : "w-64"}
          lg:translate-x-0
        `}
        style={{ "scrollbar-width": "none" }}
      >
        {/* Collapse/expand toggle (desktop) */}
        <button
          onClick={() => setIsCollapsed(v => !v)}
          class="hidden cursor-pointer lg:flex absolute -right-3 top-6 z-20 bg-white border border-gray-200 rounded-full p-1 hover:bg-gray-50 hover:border-gray-300 shadow-sm"
          aria-label={collapsed() ? "Expand sidebar" : "Collapse sidebar"}
        >
          <Show
            when={collapsed()}
            fallback={<Icons.ArrowLeftToLine size={14} class="text-gray-500" />}
          >
            <Icons.ArrowRightFromLine size={14} class="text-gray-500" />
          </Show>
        </button>

        <div class="h-screen flex flex-col overflow-y-auto">
          <SidebarHeader collapsed={collapsed()} onClose={() => setIsOpen(false)} />

          <nav class="flex-1 px-4 py-2">
            <For each={NAV_SECTIONS}>
              {section => <SidebarNavSection section={section} collapsed={collapsed()} />}
            </For>
          </nav>

          <Show when={!collapsed()}>
            <SidebarUserInfo />
          </Show>
        </div>
      </aside>
    </>
  );
}

function HamburgerButton(props: {
  isOpen: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      class="lg:hidden fixed top-4 left-4 z-20 p-2 bg-white border border-black rounded-md cursor-pointer"
      onClick={() => props.onToggle()}
    >
      <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width={2}
          d="M4 6h16M4 12h16M4 18h16"
        />
      </svg>
    </button>
  );
}

function SidebarHeader(props: {
  collapsed: boolean;
  onClose: () => void;
}) {
  return (
    <div class={`border-b border-gray-200 ${props.collapsed ? "px-2 py-6" : "px-4 py-6"}`}>
      <button
        class="absolute top-4 right-4 p-1.5 text-gray-400 hover:text-gray-600 lg:hidden rounded-md hover:bg-gray-100"
        onClick={() => props.onClose()}
      >
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width={2}
            d="M6 18L18 6M6 6l12 12"
          />
        </svg>
      </button>
      <div class={props.collapsed ? "flex justify-center" : ""}>
        {/* TODO: Replace with real company logo component */}
        <div class="w-8 h-8 bg-gray-200 rounded-md" />
      </div>
    </div>
  );
}

function SidebarNavSection(props: {
  section: NavSectionDef;
  collapsed: boolean;
}) {
  const location = useLocation();

  return (
    <section class="mb-6">
      <Show when={!props.collapsed && props.section.title}>
        <div class="px-0 py-1 text-xs font-medium text-gray-600 uppercase tracking-wider mb-1">
          {props.section.title}
        </div>
      </Show>
      <ul class="space-y-0.5">
        <For each={props.section.items}>
          {(item) => {
            const active = () => location.pathname === item.to;
            const Icon = item.icon;

            return (
              <li>
                <A
                  href={item.to}
                  class={`
                    flex items-center text-sm px-1.5 py-1.5 rounded
                    ${props.collapsed ? "justify-center" : ""}
                    ${active() ? "bg-gray-200 text-gray-900 font-medium" : "text-gray-600 hover:bg-gray-200 hover:text-gray-800"}
                  `}
                  title={props.collapsed ? item.text : undefined}
                >
                  <Icon stroke-width={1.5} size={16} class="shrink-0" />
                  <Show when={!props.collapsed}>
                    <span class="ml-3 truncate">{item.text}</span>
                  </Show>
                  <Show when={!props.collapsed && item.badge !== undefined && item.badge! > 0}>
                    <span class="ml-auto bg-gray-800 text-white text-xs font-medium min-w-5 h-5 px-1.5 flex items-center justify-center rounded-full">
                      {item.badge}
                    </span>
                  </Show>
                </A>
              </li>
            );
          }}
        </For>
      </ul>
    </section>
  );
}

function createMediaQuery(query: string) {
  const mql = window.matchMedia(query);
  const [matches, setMatches] = createSignal(mql.matches);

  const handler = (e: MediaQueryListEvent) => setMatches(e.matches);
  mql.addEventListener("change", handler);
  onCleanup(() => mql.removeEventListener("change", handler));

  return matches;
}
