// Components for Settings and Invoice preview
// These will be imported/inlined in page.tsx

import { ReactNode } from "react";

export interface SettingsType {
  companyName: string;
  companyEmail: string;
  companyPhone: string;
  invoiceTemplate: string;
}

export function SettingsSidebar({
  open,
  settings: _settings,
  draft,
  onDraftChange,
  onSave,
  onCancel,
  onClose,
}: {
  open: boolean;
  settings: SettingsType;
  draft: SettingsType;
  onDraftChange: (key: keyof SettingsType, value: string) => void;
  onSave: () => void;
  onCancel: () => void;
  onClose: () => void;
}): ReactNode {
  void _settings;
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Backdrop */}
      <div
        className="flex-1 bg-black/50 cursor-pointer"
        onClick={onClose}
      />

      {/* Sidebar */}
      <div className="w-96 bg-zinc-900 border-l border-zinc-700 shadow-lg overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-zinc-800 border-b border-zinc-700 p-4 flex justify-between items-center">
          <h2 className="text-xl font-bold text-orange-400">Settings</h2>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-orange-400 text-2xl"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-6">
          {/* Company Info Section */}
          <div className="border-b border-zinc-700 pb-4">
            <h3 className="text-lg font-semibold text-orange-400 mb-3">
              Company Information
            </h3>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-zinc-400">Company Name</label>
                <input
                  type="text"
                  value={draft.companyName}
                  onChange={(e) =>
                    onDraftChange("companyName", e.target.value)
                  }
                  className="w-full mt-1 bg-zinc-800 border border-zinc-700 rounded p-2 text-white"
                />
              </div>
              <div>
                <label className="text-xs text-zinc-400">Email</label>
                <input
                  type="email"
                  value={draft.companyEmail}
                  onChange={(e) =>
                    onDraftChange("companyEmail", e.target.value)
                  }
                  className="w-full mt-1 bg-zinc-800 border border-zinc-700 rounded p-2 text-white"
                />
              </div>
              <div>
                <label className="text-xs text-zinc-400">Phone</label>
                <input
                  type="tel"
                  value={draft.companyPhone}
                  onChange={(e) =>
                    onDraftChange("companyPhone", e.target.value)
                  }
                  className="w-full mt-1 bg-zinc-800 border border-zinc-700 rounded p-2 text-white"
                />
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <button
                onClick={onSave}
                className="flex-1 bg-orange-500 hover:bg-orange-600 text-black px-3 py-2 rounded font-semibold text-sm"
              >
                Save Changes
              </button>
              <button
                onClick={onCancel}
                className="flex-1 bg-zinc-700 hover:bg-zinc-600 text-white px-3 py-2 rounded text-sm"
              >
                Cancel
              </button>
            </div>
          </div>

          {/* Invoice Template Section */}
          <div className="border-b border-zinc-700 pb-4">
            <h3 className="text-lg font-semibold text-orange-400 mb-3">
              Invoice Template
            </h3>
            <div className="text-xs text-zinc-400 mb-2">
              Available variables: {"{companyName}"}, {"{companyEmail}"},
              {"{companyPhone}"}, {"{itemName}"}, {"{itemCode}"},
              {"{itemPrice}"}, {"{itemLocation}"}, {"{itemCondition}"},
              {"{itemDate}"}, {"{itemDimensions}"}
            </div>
            <textarea
              value={draft.invoiceTemplate}
              onChange={(e) =>
                onDraftChange("invoiceTemplate", e.target.value)
              }
              className="w-full mt-2 bg-zinc-800 border border-zinc-700 rounded p-2 text-white min-h-48 text-xs"
            />
            <div className="flex gap-2 mt-4">
              <button
                onClick={onSave}
                className="flex-1 bg-orange-500 hover:bg-orange-600 text-black px-3 py-2 rounded font-semibold text-sm"
              >
                Save Changes
              </button>
              <button
                onClick={onCancel}
                className="flex-1 bg-zinc-700 hover:bg-zinc-600 text-white px-3 py-2 rounded text-sm"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
