import { ChevronRight } from "lucide-solid";

export default function SidebarUserInfo() {
  // TODO: Wire up to real auth context
  return (
    <div class="sticky bottom-0 mt-auto bg-gray-50 border-t border-gray-200">
      <button class="w-full group">
        <div class="flex items-center justify-between px-4 py-3 hover:bg-gray-100">
          <div class="flex-1 text-left min-w-0">
            <p class="text-sm font-medium text-gray-800 truncate group-hover:text-gray-900">
              —
            </p>
            <p class="text-xs text-gray-500 truncate">—</p>
          </div>
          <ChevronRight
            size={16}
            class="text-gray-400 group-hover:text-gray-500 shrink-0"
          />
        </div>
      </button>
    </div>
  );
}
