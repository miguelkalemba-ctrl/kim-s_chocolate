"use client";

import { useSearchParams } from "next/navigation";
import Image from "next/image";
import { getHighlightedParts, getItemSuggestionLines, itemMatchesSearch } from "@/lib/itemSearch";
import { sortItemsSoldLast } from "@/lib/itemSort";
import { createAuditMetadata, getUpdatedAuditMetadata, type ItemAuditEntry } from "@/lib/itemAudit";
import { buildLabelDocumentHtml } from "@/lib/labelPrint";
import { buildInvoiceDocumentHtml } from "@/lib/invoice";
import { createQueuedOperation, shiftQueuedOperation, type QueuedOperation, type PrintOperationType } from "@/lib/operationQueue";
import { getNextCounterFromItems, normalizeSettings } from "@/lib/itemDefaults";
import { createDemoItems } from "@/lib/demoItems";
import { normalizeItem, type NormalizeItem, type NormalizeRepairStep } from "@/lib/itemNormalize";
import { type Item } from "@/lib/types";
import { CameraCaptureModal } from "@/components/CameraCaptureModal";

type PhotoLightboxProps = {
  item: Item;
  photoIdx: number;
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
};

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";

/* ---------------- TYPES ---------------- */

type RepairStep = NormalizeRepairStep;

type AppSettings = {
  companyName: string;
  companyEmail: string;
  companyPhone: string;
  companyAddress: string;
  companyVAT: string;
  invoiceLogoUrl: string;
  invoiceBankAccount: string;
  invoiceIban: string;
  invoiceBic: string;
  invoicePaymentTerms: string;
  invoiceFooterNote: string;
  defaultInvoiceEmail: string;
  confirmBeforeDelete: boolean;
  autoOpenActivityLog: boolean;
  invoiceTemplate: string;
};

type OfflineMutationType = "create" | "update" | "delete";

type OfflineMutation = {
  id: string;
  type: OfflineMutationType;
  itemId: string;
  payload?: Item;
  createdAt: number;
};

/* ---------------- HELPERS ---------------- */

const purchaseStatusTemplate = (): RepairStep[] => [
  { name: "Quote Requested", done: true },
  { name: "Awaiting Proforma", done: false },
  { name: "Proforma Approved", done: false },
  { name: "Order Placed", done: false },
  { name: "In Transit", done: false },
  { name: "Delivered", done: false },
  { name: "Invoice Received", done: false },
  { name: "Invoice Paid", done: false },
  { name: "Order Complete", done: false },
];

const formatEuro = (v: number) =>
  new Intl.NumberFormat("nl-BE", {
    style: "currency",
    currency: "EUR",
  }).format(v);

const STORAGE_KEYS = {
  items: "kwt_items_v1",
  settings: "kwt_settings_v1",
  operations: "kwt_operations_v1",
  mutations: "kwt_mutations_v1",
  sessionUser: "kwt_session_user_v1",
  serverSeed: "kwt_server_seed_v1",
} as const;

const DEFAULT_SETTINGS: AppSettings = {
  companyName: "Kim's Chocolate",
  companyEmail: "info@kimschocolate.be",
  companyPhone: "+32 (0)11 123 456",
  companyAddress: "Leuvensesteenweg 12, 3300 Tienen",
  companyVAT: "BE 0123.456.789",
  invoiceLogoUrl: "",
  invoiceBankAccount: "",
  invoiceIban: "",
  invoiceBic: "",
  invoicePaymentTerms: "",
  invoiceFooterNote: "",
  defaultInvoiceEmail: "",
  confirmBeforeDelete: true,
  autoOpenActivityLog: true,
  invoiceTemplate: "default",
};

const ADD_ITEM_CATEGORIES = ["Containers", "Sealing", "Labels", "Protection", "Packaging"];
const ADD_ITEM_LOCATIONS = ["Warehouse A", "Shop Floor", "Repair Zone"];

/* ---------------- PAGE ---------------- */

function PageContent() {
                const searchParams = useSearchParams();
                const activeView = searchParams.get("view") === "items" ? "items" : "dashboard";
                const panelAction = searchParams.get("panel");
                  // --- Toast State ---
                  const [toast, setToast] = useState<string | null>(null);
                  function showToast(msg: string) {
                    setToast(msg);
                    setTimeout(() => setToast(null), 2500);
                  }
                // --- Activity Log State ---
                const [activityLog, setActivityLog] = useState<{key: string; msg: string; ts: number}[]>([]);
                const [logOpen, setLogOpen] = useState(false);
                const [logStart, setLogStart] = useState(0); // index of first visible entry when open

                // --- Settings State ---
                const [settingsOpen, setSettingsOpen] = useState(false);
                const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
                const [settingsDraft, setSettingsDraft] = useState(settings);

                // --- Invoice Preview State ---
                const [invoicePreviewItem, setInvoicePreviewItem] = useState<Item | null>(null);

                function addLog(key: string, msg: string) {
                  const ts = Date.now();
                  setActivityLog((prev) => {
                    const filtered = prev.filter((e) => e.key !== key);
                    const next = [{ key, msg, ts }, ...filtered];
                    return next.slice(0, 50);
                  });
                  if (settings.autoOpenActivityLog) {
                    setLogOpen(true);
                    setLogStart(0);
                  }
                }

                function removeLog(key: string) {
                  setActivityLog((prev) => prev.filter((e) => e.key !== key));
                }

                // convenience wrapper for generic messages
                function logActivity(msg: string) {
                  // store plain message; rendering will format date/time
                  addLog(`gen:${Date.now()}`, msg);
                }

                // auto–close when the panel is open
                useEffect(() => {
                  if (!logOpen) return;
                  const timer = setTimeout(() => setLogOpen(false), 10000);
                  return () => clearTimeout(timer);
                }, [logOpen]);

                // reset scroll start when log contents change
                useEffect(() => {
                  if (logOpen) setLogStart(0);
                }, [activityLog, logOpen]);
              // --- Undo/Redo State ---
              const [, setUndoStack] = useState<Item[][]>([]);
              const [, setRedoStack] = useState<Item[][]>([]);

              // Helper to push current state to undo stack
              function pushUndo(items: Item[]) {
                setUndoStack((prev) => [...prev, items]);
                setRedoStack([]); // clear redo on new action
              }


              // Wrap updates to support undo (used in modal save)
              function updateItemWithUndo(updated: Item) {
                pushUndo(items);
                updateItem(updated, "edited");
                logActivity(`Edited item: ${updated.name}`);
                showToast(`Item updated: ${updated.name}`);
              }

              // --- PDF/Excel Export ---
              function exportPDF() {
                // Simple client-side PDF export using window.print()
                window.print();
                logActivity("Exported items to PDF (print)");
                showToast("Exported to PDF");
              }
              function exportExcel() {
                // Export as CSV but with .xls extension for Excel compatibility
                const headers = [
                  "code",
                  "name",
                  "category",
                  "price",
                  "location",
                  "width",
                  "height",
                  "depth",
                  "repairs",
                  "photos"
                ];
                const rows = filteredItems.map((item: Item) => [
                  item.code,
                  item.name,
                  item.category,
                  item.price,
                  item.location,
                  item.width,
                  item.height,
                  item.depth,
                  item.repairs.map((r: RepairStep) => `${r.name}:${r.done ? "done" : "todo"}`).join("|"),
                  item.photos.length
                ]);
                const csv = [headers.join(","), ...rows.map((r: (string|number)[]) => r.join(","))].join("\n");
                const blob = new Blob([csv], { type: "application/vnd.ms-excel" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = "items.xls";
                a.click();
                URL.revokeObjectURL(url);
                logActivity("Exported items to Excel");
                showToast("Exported to Excel");
              }
            function exportCSV() {
              const headers = [
                "code",
                "name",
                "category",
                "price",
                "location",
                "width",
                "height",
                "depth",
                "repairs",
                "photos"
              ];
              const rows = filteredItems.map((item: Item) => [
                item.code,
                item.name,
                item.category,
                item.price,
                item.location,
                item.width,
                item.height,
                item.depth,
                item.repairs.map((r: RepairStep) => `${r.name}:${r.done ? "done" : "todo"}`).join("|"),
                item.photos.length
              ]);
              const csv = [headers.join(","), ...rows.map((r: (string|number)[]) => r.join(","))].join("\n");
              const blob = new Blob([csv], { type: "text/csv" });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = "kims-chocolate-items.csv";
              a.click();
              URL.revokeObjectURL(url);
            }

            // --- Settings & Invoice Handlers ---
            function handleSettingsDraftChange(key: keyof AppSettings, value: string | boolean) {
              setSettingsDraft((prev) => ({ ...prev, [key]: value }));
            }

            function handleSaveCompanyInfo() {
              setSettings((prev) => ({
                ...prev,
                companyName: settingsDraft.companyName,
                companyEmail: settingsDraft.companyEmail,
                companyPhone: settingsDraft.companyPhone,
                companyAddress: settingsDraft.companyAddress,
                companyVAT: settingsDraft.companyVAT,
              }));
              showToast("Company info saved");
            }

            function handleCancelCompanyInfo() {
              setSettingsDraft((prev) => ({
                ...prev,
                companyName: settings.companyName,
                companyEmail: settings.companyEmail,
                companyPhone: settings.companyPhone,
                companyAddress: settings.companyAddress,
                companyVAT: settings.companyVAT,
              }));
            }

            function handleSaveInvoiceTemplate() {
              setSettings((prev) => ({
                ...prev,
                invoiceTemplate: settingsDraft.invoiceTemplate,
                invoiceLogoUrl: settingsDraft.invoiceLogoUrl,
                invoiceBankAccount: settingsDraft.invoiceBankAccount,
                invoiceIban: settingsDraft.invoiceIban,
                invoiceBic: settingsDraft.invoiceBic,
                invoicePaymentTerms: settingsDraft.invoicePaymentTerms,
                invoiceFooterNote: settingsDraft.invoiceFooterNote,
              }));
              showToast("Invoice settings saved");
            }

            function handleCancelInvoiceTemplate() {
              setSettingsDraft((prev) => ({
                ...prev,
                invoiceTemplate: settings.invoiceTemplate,
                invoiceLogoUrl: settings.invoiceLogoUrl,
                invoiceBankAccount: settings.invoiceBankAccount,
                invoiceIban: settings.invoiceIban,
                invoiceBic: settings.invoiceBic,
                invoicePaymentTerms: settings.invoicePaymentTerms,
                invoiceFooterNote: settings.invoiceFooterNote,
              }));
            }

            function handleSaveAppPreferences() {
              setSettings((prev) => ({
                ...prev,
                defaultInvoiceEmail: settingsDraft.defaultInvoiceEmail,
                confirmBeforeDelete: settingsDraft.confirmBeforeDelete,
                autoOpenActivityLog: settingsDraft.autoOpenActivityLog,
              }));
              showToast("App preferences saved");
            }

            function handleCancelAppPreferences() {
              setSettingsDraft((prev) => ({
                ...prev,
                defaultInvoiceEmail: settings.defaultInvoiceEmail,
                confirmBeforeDelete: settings.confirmBeforeDelete,
                autoOpenActivityLog: settings.autoOpenActivityLog,
              }));
            }

            function valueOrPlaceholder(value: string, placeholder: string) {
              const trimmed = value?.trim();
              return trimmed && trimmed.length > 0 ? trimmed : placeholder;
            }

            function getInvoiceViewModel(item: Item) {
              return {
                companyName: valueOrPlaceholder(settings.companyName, "ADD COMPANY NAME"),
                companyAddress: valueOrPlaceholder(settings.companyAddress, "ADD COMPANY ADDRESS"),
                companyEmail: valueOrPlaceholder(settings.companyEmail, "ADD COMPANY EMAIL"),
                companyPhone: valueOrPlaceholder(settings.companyPhone, "ADD COMPANY PHONE"),
                companyVAT: valueOrPlaceholder(settings.companyVAT, "ADD VAT NUMBER"),
                logoUrl: settings.invoiceLogoUrl.trim(),
                bankAccount: valueOrPlaceholder(settings.invoiceBankAccount, "ADD BANK ACCOUNT"),
                iban: valueOrPlaceholder(settings.invoiceIban, "ADD IBAN"),
                bic: valueOrPlaceholder(settings.invoiceBic, "ADD BIC/SWIFT"),
                paymentTerms: valueOrPlaceholder(settings.invoicePaymentTerms, "ADD PAYMENT TERMS"),
                footerNote: valueOrPlaceholder(settings.invoiceFooterNote, "ADD INVOICE FOOTER NOTE"),
                invoiceNumber: `INV-${item.code}`,
                issueDate: item.dateAdded,
                itemName: item.name,
                itemCode: item.code,
                itemCategory: item.category,
                itemCondition: item.condition,
                itemLocation: item.location,
                itemDimensions: `${item.width} × ${item.height} × ${item.depth} cm`,
                itemPrice: formatEuro(item.price),
              };
            }

            function buildInvoiceMailText(item: Item) {
              const model = getInvoiceViewModel(item);
              return [
                `Invoice ${model.invoiceNumber}`,
                `Issue Date: ${model.issueDate}`,
                "",
                `${model.companyName}`,
                `${model.companyAddress}`,
                `VAT: ${model.companyVAT}`,
                `Email: ${model.companyEmail}`,
                `Phone: ${model.companyPhone}`,
                "",
                `Item: ${model.itemName} (${model.itemCode})`,
                `Category: ${model.itemCategory}`,
                `Condition: ${model.itemCondition}`,
                `Location: ${model.itemLocation}`,
                `Dimensions: ${model.itemDimensions}`,
                `Total: ${model.itemPrice}`,
                "",
                `Payment terms: ${model.paymentTerms}`,
                `Bank account: ${model.bankAccount}`,
                `IBAN: ${model.iban}`,
                `BIC/SWIFT: ${model.bic}`,
                "",
                model.footerNote,
              ].join("\n");
            }

            function printLabels(labelItems: Item[]) {
              if (labelItems.length === 0) {
                showToast("No items available for label printing");
                return;
              }

              const printWindow = window.open("", "_blank");
              if (!printWindow) {
                showToast("Popup blocked. Please allow popups to print labels.");
                return;
              }

              printWindow.document.write(buildLabelDocumentHtml(labelItems));
              printWindow.document.close();
              printWindow.focus();
              printWindow.print();
            }

            function printInvoices(invoiceItems: Item[]) {
              if (invoiceItems.length === 0) {
                showToast("No items available for invoice printing");
                return;
              }

              const printWindow = window.open("", "_blank");
              if (!printWindow) {
                showToast("Popup blocked. Please allow popups to print invoices.");
                return;
              }

              printWindow.document.write(
                buildInvoiceDocumentHtml(invoiceItems, {
                  companyName: settings.companyName,
                  companyAddress: settings.companyAddress,
                  companyEmail: settings.companyEmail,
                  companyPhone: settings.companyPhone,
                  companyVAT: settings.companyVAT,
                  invoiceLogoUrl: settings.invoiceLogoUrl,
                  invoiceBankAccount: settings.invoiceBankAccount,
                  invoiceIban: settings.invoiceIban,
                  invoiceBic: settings.invoiceBic,
                  invoicePaymentTerms: settings.invoicePaymentTerms,
                  invoiceFooterNote: settings.invoiceFooterNote,
                })
              );
              printWindow.document.close();
              printWindow.focus();
              printWindow.print();
            }

            function queuePrintOperation(type: PrintOperationType, itemIds: string[]) {
              const operation = createQueuedOperation(type, itemIds);
              if (!operation) return;
              setOperationQueue((prev) => [...prev, operation]);
            }

            function processNextQueuedOperation() {
              if (!isOnline) {
                showToast("Still offline. Queued operations will run when online.");
                return;
              }

              if (operationQueue.length === 0) {
                showToast("No queued operations.");
                return;
              }

              const { nextOperation, remaining } = shiftQueuedOperation(operationQueue);
              if (!nextOperation) {
                showToast("No queued operations.");
                return;
              }
              const operationItems = items.filter((item) => nextOperation.itemIds.includes(item.id));

              if (operationItems.length === 0) {
                setOperationQueue(remaining);
                showToast("Skipped queued operation: items no longer exist.");
                return;
              }

              if (nextOperation.type === "print-label") {
                printLabels(operationItems);
                logActivity(`Processed queued label print for ${operationItems.length} item(s)`);
              } else {
                printInvoices(operationItems);
                logActivity(`Processed queued invoice print for ${operationItems.length} item(s)`);
              }

              setOperationQueue(remaining);
              showToast(`Processed 1 queued operation (${remaining.length} left)`);
            }

            function handleInvoiceClick() {
              if (!selectedItem) {
                showToast("Please select an item first");
                return;
              }
              setInvoicePreviewItem(selectedItem);
              showToast("Invoice preview opened");
            }

            function handleItemInvoiceClick(item: Item) {
              setInvoicePreviewItem(item);
              showToast(`Invoice preview opened for ${item.name}`);
            }

            function handleInvoiceSavePDF() {
              if (!invoicePreviewItem) return;
              if (!isOnline) {
                queuePrintOperation("print-invoice", [invoicePreviewItem.id]);
                showToast("Offline: invoice print queued for when you are back online.");
                return;
              }
              printInvoices([invoicePreviewItem]);
              showToast("Print dialog opened. Choose 'Save as PDF'.");
            }

            function handleInvoicePrint() {
              if (!invoicePreviewItem) return;
              if (!isOnline) {
                queuePrintOperation("print-invoice", [invoicePreviewItem.id]);
                showToast("Offline: invoice print queued for when you are back online.");
                return;
              }
              printInvoices([invoicePreviewItem]);
              showToast("Invoice printed");
            }

            function handleInvoiceMail() {
              if (!invoicePreviewItem) return;
              const invoiceText = buildInvoiceMailText(invoicePreviewItem);
              const subject = encodeURIComponent(`Invoice ${invoicePreviewItem.code}`);
              const body = encodeURIComponent(invoiceText);
              const to = encodeURIComponent(settings.defaultInvoiceEmail || "");
              window.location.href = `mailto:${to}?subject=${subject}&body=${body}`;
              showToast("Opening email client");
            }

            function getItemStatus(item: Item): "Sold" | "Active" {
              return item.sold ? "Sold" : "Active";
            }

            function getCurrentWorkflowStatus(item: Item): string {
              if (item.sold) return "Sold";

              const byName = new Map(item.repairs.map((step) => [step.name, step]));
              const readyForSale = byName.get("Ready for Sale");
              const qualityControl = byName.get("Quality Control");
              const check = byName.get("Check");
              const intake = byName.get("Intake");
              const repairStep = byName.get("Repair") as RepairStep | undefined;

              if (readyForSale?.done) return "Ready for sale";
              if (qualityControl?.done) return "Quality control";

              if (repairStep) {
                const state = repairStep.state || (repairStep.done ? "noNeed" : "none");
                if (state === "noNeed") return "No repair needed";
                if (state === "inProgress") return "Being repaired";
                if (state === "repaired") return "Repaired";
              }

              if (check?.done) return "Check";
              if (intake?.done) return "Intake";
              return "Repair needed";
            }

            function getExactRepairOverview(item: Item): string {
              const currentStatus = getCurrentWorkflowStatus(item);
              if (currentStatus === "Sold") return "Status: Sold";
              if (currentStatus === "Ready for sale") return "Status: Ready for sale";
              const nextPending = item.repairs.find((step) => !step.done);

              if (!nextPending) {
                return `Status: ${currentStatus}`;
              }

              return `Status: ${currentStatus} | Next: ${nextPending.name}`;
            }

            function setItemCardRef(itemId: string, node: HTMLDivElement | null) {
              itemCardRefs.current[itemId] = node;
            }

            function centerItemCard(itemId: string) {
              const node = itemCardRefs.current[itemId];
              const container = itemsScrollRef.current;
              if (!node || !container) return;

              const containerRect = container.getBoundingClientRect();
              const nodeRect = node.getBoundingClientRect();
              const offsetInContainer = nodeRect.top - containerRect.top + container.scrollTop;
              const target = offsetInContainer - container.clientHeight / 2 + node.clientHeight / 2;
              const maxTop = Math.max(0, container.scrollHeight - container.clientHeight);
              const nextTop = Math.max(0, Math.min(target, maxTop));

              container.scrollTo({ top: nextTop, behavior: "smooth" });
            }

            function isInteractiveTarget(target: EventTarget | null): boolean {
              if (!(target instanceof HTMLElement)) return false;
              return Boolean(target.closest("button, input, label, select, textarea, a"));
            }

            function selectItemFromCard(item: Item) {
              centerItemCard(item.id);
            }

            function applySoldStatus(itemId: string, nextSold: boolean) {
              const user = activeUser.trim() || "unknown";
              const current = items.find((it) => it.id === itemId);
              if (!current) return;

              const audit = getUpdatedAuditMetadata(current, user, nextSold ? "marked-sold" : "marked-active");
              const soldAt = nextSold ? new Date().toISOString() : null;
              const soldBy = nextSold ? user : null;
              const updatedItem: Item = {
                ...current,
                sold: nextSold,
                soldAt,
                soldBy,
                ...audit,
              };

              setItems((prev) => prev.map((it) => (it.id === itemId ? updatedItem : it)));
              setSelectedItem((prev) => (prev && prev.id === itemId ? updatedItem : prev));
              void syncItemUpdate(updatedItem, "Sold status");

              if (nextSold) {
                logActivity(`Sold: ${current.name}`);
                showToast(`${current.name} marked as sold`);
              } else {
                logActivity(`Purchase cancelled: ${current.name} is active again`);
                showToast(`${current.name} moved back to active`);
              }
            }

            function requestToggleSold(itemId: string, nextSold: boolean) {
              if (nextSold) {
                setSoldConfirmationItemId(itemId);
                return;
              }

              const confirmed = window.confirm("Cancel purchase and move this item back to active stock?");
              if (!confirmed) return;
              applySoldStatus(itemId, false);
            }

            function confirmSoldToggle() {
              if (!soldConfirmationItemId) return;
              applySoldStatus(soldConfirmationItemId, true);
              setSoldConfirmationItemId(null);
            }

          const [sortField, setSortField] = useState<string>("");
          const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
        const [search, setSearch] = useState("");
        const [searchFocused, setSearchFocused] = useState(false);
        const [filterCategory, setFilterCategory] = useState("");
        const [filterLocation, setFilterLocation] = useState("");
      const [lightbox, setLightbox] = useState<{item: Item, photoIdx: number} | null>(null);
            function deleteItem(itemId: string) {
              if (settings.confirmBeforeDelete) {
                const confirmed = window.confirm("Are you sure you want to delete this item?");
                if (!confirmed) return;
              }
              const item = items.find((entry) => entry.id === itemId);
              const itemName = item?.name || "Item";
              setItems((prev) => prev.filter((it) => it.id !== itemId));
              setSelectedItemIds((prev) => prev.filter((id) => id !== itemId));
              setSelectedItem((sel) => (sel && sel.id === itemId ? null : sel));
              void syncItemDelete(itemId, itemName);
            }
    function toggleRepairStep(itemId: string, stepIdx: number) {
      const currentItem = items.find((entry) => entry.id === itemId);
      if (!currentItem) return;

      // we'll use these to record log actions after updating
      let addedLog: string | null = null;
      let removedKey: string | null = null;

      const clickedStep = currentItem.repairs[stepIdx];
      if (!clickedStep) return;
      const isRepairStep = clickedStep.name === "Repair";
      const prevState = (clickedStep as RepairStep).state || "none";

      let newDone = clickedStep.done;
      let newState = prevState;
      let triggerCheckCascade = false;
      let triggerUncheckCascade = false;

      if (isRepairStep) {
        switch (newState) {
          case "none":
            newState = "noNeed";
            newDone = true;
            break;
          case "noNeed":
            newState = "inProgress";
            newDone = false;
            break;
          case "inProgress":
            newState = "repaired";
            newDone = true;
            break;
          case "repaired":
            newState = "none";
            newDone = false;
            break;
        }

        if (prevState !== "repaired" && newState === "repaired") {
          addedLog = `${currentItem.name} is repaired in ${currentItem.repairLocation || currentItem.location}`;
        } else if (prevState === "repaired" && newState !== "repaired") {
          removedKey = `repair:${itemId}`;
        }

        if (newDone && !clickedStep.done) triggerCheckCascade = true;
        if (!newDone && clickedStep.done) triggerUncheckCascade = true;
      } else {
        const shouldCheck = !clickedStep.done;
        if (shouldCheck) {
          newDone = true;
          triggerCheckCascade = true;
        } else {
          newDone = false;
          triggerUncheckCascade = true;
        }
      }

      const updatedItem: Item = {
        ...currentItem,
        repairs: currentItem.repairs.map((s, i) => {
          if (i === stepIdx) {
            const updated: RepairStep = { ...s, done: newDone };
            if (isRepairStep) updated.state = newState;
            return updated;
          }

          if (triggerCheckCascade && i < stepIdx) {
            return {
              ...s,
              done: true,
              ...(s.name === "Repair" ? { state: "noNeed" } : {}),
            };
          }

          if (triggerUncheckCascade && i > stepIdx) {
            return {
              ...s,
              done: false,
              ...(s.name === "Repair" ? { state: "none" } : {}),
            };
          }

          return s;
        }),
      };

      setItems((prev) => prev.map((it) => (it.id === itemId ? updatedItem : it)));
      void syncItemUpdate(updatedItem, "Purchase status");

      if (addedLog) addLog(`repair:${itemId}`, addedLog);
      if (removedKey) removeLog(removedKey);
    }
  const [mounted, setMounted] = useState(false);
  const [uiTheme, setUiTheme] = useState<"chocolate" | "dark">("chocolate");
  const [items, setItems] = useState<Item[]>([]);
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [showKPI, setShowKPI] = useState(false);
  const [showAnalyticsPopup, setShowAnalyticsPopup] = useState(false);
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);
  const [soldConfirmationItemId, setSoldConfirmationItemId] = useState<string | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [operationQueue, setOperationQueue] = useState<QueuedOperation[]>([]);
  const [mutationQueue, setMutationQueue] = useState<OfflineMutation[]>([]);
  const [activeUser, setActiveUser] = useState("");
  const [showSessionModal, setShowSessionModal] = useState(false);
  const [syncBusy, setSyncBusy] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(null);
  const [syncSummary, setSyncSummary] = useState<{ local: number; server: number; merged: number } | null>(null);
  const [syncHealth, setSyncHealth] = useState<{
    lastLatencyMs: number | null;
    lastStatus: "idle" | "ok" | "error";
    errorCount: number;
    lastErrorAt: number | null;
    lastRequestId: string | null;
  }>({
    lastLatencyMs: null,
    lastStatus: "idle",
    errorCount: 0,
    lastErrorAt: null,
    lastRequestId: null,
  });
  const [debouncedSearch, setDebouncedSearch] = useState("");

  const counterRef = useRef(1);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const updateTheme = () => {
      const html = document.documentElement;
      if (html.classList.contains("dark")) {
        setUiTheme("dark");
      } else {
        setUiTheme("chocolate");
      }
    };

    updateTheme();

    const observer = new MutationObserver(updateTheme);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);
  const mutationSyncingRef = useRef(false);
  const itemCardRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const itemsScrollRef = useRef<HTMLDivElement | null>(null);

  const normalizeIncomingItems = useCallback((entries: unknown[]): Item[] => {
    return entries
      .map((entry) => normalizeItem(entry, purchaseStatusTemplate))
      .filter((entry): entry is NormalizeItem => entry !== null) as Item[];
  }, []);

  const getSessionHeaders = useCallback((): Record<string, string> => {
    const user = activeUser.trim() || "guest";
    return { "x-session-user": user };
  }, [activeUser]);

  function createOfflineMutation(type: OfflineMutationType, itemId: string, payload?: Item): OfflineMutation {
    return {
      id: `mut-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
      type,
      itemId,
      payload,
      createdAt: Date.now(),
    };
  }

  function queueItemMutation(type: OfflineMutationType, itemId: string, payload?: Item) {
    const nextMutation = createOfflineMutation(type, itemId, payload);

    setMutationQueue((prev) => {
      if (type === "create") {
        const withoutCreate = prev.filter((entry) => !(entry.type === "create" && entry.itemId === itemId));
        return [...withoutCreate, nextMutation];
      }

      if (type === "update") {
        const hasPendingDelete = prev.some((entry) => entry.itemId === itemId && entry.type === "delete");
        if (hasPendingDelete) return prev;
        const withoutUpdates = prev.filter((entry) => !(entry.type === "update" && entry.itemId === itemId));
        return [...withoutUpdates, nextMutation];
      }

      const hasPendingCreate = prev.some((entry) => entry.itemId === itemId && entry.type === "create");
      if (hasPendingCreate) {
        // Create + delete before sync can be dropped entirely.
        return prev.filter((entry) => entry.itemId !== itemId);
      }

      const withoutItemMutations = prev.filter((entry) => entry.itemId !== itemId);
      return [...withoutItemMutations, nextMutation];
    });
  }

  const replaceItemsFromPayload = useCallback((payload: { items?: unknown[] }) => {
    const nextItems = Array.isArray(payload.items) ? normalizeIncomingItems(payload.items) : [];
    if (nextItems.length > 0) {
      setItems(nextItems);
      counterRef.current = getNextCounterFromItems(nextItems);
    }
  }, [normalizeIncomingItems]);

  const trackSyncHealth = useCallback((input: { status: "ok" | "error"; startedAt: number; requestId?: string | null }) => {
    const latencyMs = Math.max(0, Date.now() - input.startedAt);
    setSyncHealth((prev) => ({
      ...prev,
      lastLatencyMs: latencyMs,
      lastStatus: input.status,
      errorCount: input.status === "error" ? prev.errorCount + 1 : prev.errorCount,
      lastErrorAt: input.status === "error" ? Date.now() : prev.lastErrorAt,
      lastRequestId: input.requestId ?? prev.lastRequestId,
    }));
  }, []);

  async function syncItemUpdate(updatedItem: Item, actionName: string) {
    if (!isOnline) {
      queueItemMutation("update", updatedItem.id, updatedItem);
      return;
    }
    const startedAt = Date.now();
    let tracked = false;
    try {
      const response = await fetch(`/api/items/${updatedItem.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...getSessionHeaders(),
        },
        body: JSON.stringify(updatedItem),
      });

      const requestId = response.headers.get("x-request-id");
      if (!response.ok) {
        trackSyncHealth({ status: "error", startedAt, requestId });
        tracked = true;
        throw new Error("SYNC_UPDATE_FAILED");
      }
      trackSyncHealth({ status: "ok", startedAt, requestId });
      tracked = true;
      const payload = (await response.json()) as { items?: unknown[] };
      replaceItemsFromPayload(payload);
    } catch {
      queueItemMutation("update", updatedItem.id, updatedItem);
      if (!tracked) trackSyncHealth({ status: "error", startedAt });
      showToast(`${actionName} saved locally. Could not sync to shared server store.`);
    }
  }

  async function syncItemDelete(itemId: string, itemName: string) {
    if (!isOnline) {
      queueItemMutation("delete", itemId);
      return;
    }
    const startedAt = Date.now();
    let tracked = false;
    try {
      const response = await fetch(`/api/items/${itemId}`, {
        method: "DELETE",
        headers: getSessionHeaders(),
      });

      const requestId = response.headers.get("x-request-id");
      if (!response.ok) {
        trackSyncHealth({ status: "error", startedAt, requestId });
        tracked = true;
        throw new Error("SYNC_DELETE_FAILED");
      }
      trackSyncHealth({ status: "ok", startedAt, requestId });
      tracked = true;
      const payload = (await response.json()) as { items?: unknown[] };
      replaceItemsFromPayload(payload);
    } catch {
      queueItemMutation("delete", itemId);
      if (!tracked) trackSyncHealth({ status: "error", startedAt });
      showToast(`${itemName} deleted locally. Could not sync delete to shared server store.`);
    }
  }

  const processNextItemMutation = useCallback(async () => {
    if (!isOnline || mutationSyncingRef.current || mutationQueue.length === 0) return;

    const mutation = mutationQueue[0];
    mutationSyncingRef.current = true;

    try {
      if (mutation.type === "create") {
        if (!mutation.payload) {
          setMutationQueue((prev) => prev.slice(1));
          return;
        }

        const startedAt = Date.now();
        const item = mutation.payload;
        const response = await fetch("/api/items", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...getSessionHeaders(),
          },
          body: JSON.stringify({
            name: item.name,
            category: item.category,
            price: item.price,
            location: item.location,
            repairLocation: item.repairLocation,
            width: item.width,
            height: item.height,
            depth: item.depth,
            condition: item.condition,
            damageDescription: item.damageDescription,
            notes: item.notes,
            brand: item.brand,
            year: item.year,
            material: item.material,
            photos: item.photos,
            sold: item.sold,
            repairs: item.repairs,
            dateAdded: item.dateAdded,
          }),
        });

        const requestId = response.headers.get("x-request-id");
        if (!response.ok) {
          trackSyncHealth({ status: "error", startedAt, requestId });
          return;
        }

        trackSyncHealth({ status: "ok", startedAt, requestId });
        const payload = (await response.json()) as { item?: unknown; items?: unknown[] };
        const created = payload.item ? normalizeItem(payload.item, purchaseStatusTemplate) : null;

        replaceItemsFromPayload(payload);

        if (created && mutation.itemId !== created.id) {
          setSelectedItemIds((prev) => prev.map((id) => (id === mutation.itemId ? created.id : id)));
          setSelectedItem((prev) => (prev && prev.id === mutation.itemId ? created : prev));
          setMutationQueue((prev) => {
            const rest = prev.slice(1);
            return rest.map((entry) => {
              if (entry.itemId !== mutation.itemId) return entry;
              if (!entry.payload) return { ...entry, itemId: created.id };
              return {
                ...entry,
                itemId: created.id,
                payload: {
                  ...entry.payload,
                  id: created.id,
                  code: created.code,
                },
              };
            });
          });
        } else {
          setMutationQueue((prev) => prev.slice(1));
        }

        setLastSyncedAt(Date.now());
        return;
      }

      if (mutation.type === "update") {
        if (!mutation.payload) {
          setMutationQueue((prev) => prev.slice(1));
          return;
        }

        const startedAt = Date.now();
        const response = await fetch(`/api/items/${mutation.itemId}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            ...getSessionHeaders(),
          },
          body: JSON.stringify(mutation.payload),
        });

        const requestId = response.headers.get("x-request-id");
        if (!response.ok) {
          trackSyncHealth({ status: "error", startedAt, requestId });
          return;
        }

        trackSyncHealth({ status: "ok", startedAt, requestId });
        const payload = (await response.json()) as { items?: unknown[] };
        replaceItemsFromPayload(payload);
        setMutationQueue((prev) => prev.slice(1));
        setLastSyncedAt(Date.now());
        return;
      }

      const startedAt = Date.now();
      const response = await fetch(`/api/items/${mutation.itemId}`, {
        method: "DELETE",
        headers: getSessionHeaders(),
      });

      const requestId = response.headers.get("x-request-id");
      if (!response.ok) {
        trackSyncHealth({ status: "error", startedAt, requestId });
        return;
      }

      trackSyncHealth({ status: "ok", startedAt, requestId });
      const payload = (await response.json()) as { items?: unknown[] };
      replaceItemsFromPayload(payload);
      setMutationQueue((prev) => prev.slice(1));
      setLastSyncedAt(Date.now());
    } catch {
      // Keep mutation in queue and retry next time when connectivity is stable.
    } finally {
      mutationSyncingRef.current = false;
    }
  }, [isOnline, mutationQueue, getSessionHeaders, trackSyncHealth, replaceItemsFromPayload]);

  const fetchServerItems = useCallback(async (): Promise<Item[] | null> => {
    const startedAt = Date.now();
    try {
      const response = await fetch("/api/items", { cache: "no-store" });
      const requestId = response.headers.get("x-request-id");
      if (!response.ok) {
        trackSyncHealth({ status: "error", startedAt, requestId });
        return null;
      }
      trackSyncHealth({ status: "ok", startedAt, requestId });
      const payload = (await response.json()) as { items?: unknown[] };
      return Array.isArray(payload.items) ? normalizeIncomingItems(payload.items) : [];
    } catch {
      trackSyncHealth({ status: "error", startedAt });
      return null;
    }
  }, [normalizeIncomingItems, trackSyncHealth]);

  const seedServerFromLocal = useCallback(async (localItems: Item[]) => {
    const sessionHeaders = {
      "Content-Type": "application/json",
      "x-session-user": activeUser.trim() || "migration",
    };

    await Promise.all(
      localItems.map(async (item) => {
        const startedAt = Date.now();
        const response = await fetch("/api/items", {
          method: "POST",
          headers: sessionHeaders,
          body: JSON.stringify({
            name: item.name,
            category: item.category,
            price: item.price,
            location: item.location,
            repairLocation: item.repairLocation,
            width: item.width,
            height: item.height,
            depth: item.depth,
            condition: item.condition,
            damageDescription: item.damageDescription,
            notes: item.notes,
            brand: item.brand,
            year: item.year,
            material: item.material,
            photos: item.photos,
            sold: item.sold,
            repairs: item.repairs,
            dateAdded: item.dateAdded,
          }),
        });

        const requestId = response.headers.get("x-request-id");
        if (!response.ok) {
          trackSyncHealth({ status: "error", startedAt, requestId });
          throw new Error("SEED_SYNC_FAILED");
        }
        trackSyncHealth({ status: "ok", startedAt, requestId });
      })
    );
  }, [activeUser, trackSyncHealth]);

  const readLocalItemsSnapshot = useCallback((): Item[] => {
    try {
      const rawLocal = localStorage.getItem(STORAGE_KEYS.items);
      const parsedLocal = rawLocal ? JSON.parse(rawLocal) : [];
      return Array.isArray(parsedLocal) ? normalizeIncomingItems(parsedLocal) : [];
    } catch {
      return [];
    }
  }, [normalizeIncomingItems]);

  const mergeMissingLocalIntoServer = useCallback(async (serverItems: Item[], localItems: Item[]) => {
    const existingCodes = new Set(serverItems.map((entry) => entry.code));
    const missing = localItems.filter((entry) => !existingCodes.has(entry.code));
    if (missing.length === 0) return 0;
    await seedServerFromLocal(missing);
    localStorage.setItem(STORAGE_KEYS.serverSeed, "1");
    return missing.length;
  }, [seedServerFromLocal]);

  const runSyncNow = useCallback(async (options?: { announce?: boolean }) => {
    if (syncBusy) return;
    setSyncBusy(true);
    try {
      const serverBefore = await fetchServerItems();
      if (!serverBefore) {
        if (options?.announce) showToast("Sync failed: server unavailable.");
        return;
      }

      const localItems = readLocalItemsSnapshot();
      const hasPendingItemMutations = mutationQueue.length > 0;
      const merged = hasPendingItemMutations
        ? 0
        : await mergeMissingLocalIntoServer(serverBefore, localItems);
      const serverAfter = (await fetchServerItems()) || serverBefore;
      setSyncSummary({
        local: localItems.length,
        server: serverAfter.length,
        merged,
      });

      if (serverAfter.length > 0) {
        setItems(serverAfter);
        counterRef.current = getNextCounterFromItems(serverAfter);
      }

      setLastSyncedAt(Date.now());

      if (options?.announce) {
        if (merged > 0) {
          showToast(`Sync complete: ${merged} local item(s) added to shared store.`);
        } else if (hasPendingItemMutations) {
          showToast(`Sync started: ${mutationQueue.length} queued local change(s) will sync automatically.`);
        } else {
          showToast(`Sync complete: ${serverAfter.length} shared item(s) loaded.`);
        }
      }
    } finally {
      setSyncBusy(false);
    }
  }, [fetchServerItems, readLocalItemsSnapshot, mergeMissingLocalIntoServer, mutationQueue, syncBusy]);

  async function copyItemCode(code: string) {
    try {
      await navigator.clipboard.writeText(code);
      showToast(`Copied ${code}`);
    } catch {
      showToast("Could not copy code");
    }
  }

  async function copyLastSyncRequestId() {
    const requestId = syncHealth.lastRequestId;
    if (!requestId) {
      showToast("No sync request id available yet.");
      return;
    }

    try {
      await navigator.clipboard.writeText(requestId);
      showToast("Copied last sync request id");
    } catch {
      showToast("Could not copy request id");
    }
  }

  async function copyTechnicalSnapshot() {
    const snapshot = {
      capturedAt: new Date().toISOString(),
      activeUser: activeUser.trim() || "unknown",
      isOnline,
      itemCount: items.length,
      queuedOperations: operationQueue.length,
      queuedItemMutations: mutationQueue.length,
      lastSyncedAt,
      syncHealth,
    };

    try {
      await navigator.clipboard.writeText(JSON.stringify(snapshot, null, 2));
      showToast("Copied technical snapshot");
    } catch {
      showToast("Could not copy technical snapshot");
    }
  }

  function resetSyncErrorCounter() {
    setSyncHealth((prev) => ({
      ...prev,
      errorCount: 0,
      lastErrorAt: null,
      lastStatus: prev.lastStatus === "error" ? "idle" : prev.lastStatus,
    }));
    showToast("Sync error counter reset");
  }

  useEffect(() => {
    setMounted(true);
    setIsOnline(typeof navigator !== "undefined" ? navigator.onLine : true);

    const fallbackItems = createDemoItems(purchaseStatusTemplate);

    try {
      const rawSettings = localStorage.getItem(STORAGE_KEYS.settings);
      const parsedSettings = rawSettings ? JSON.parse(rawSettings) : null;
      const nextSettings = normalizeSettings(parsedSettings, DEFAULT_SETTINGS);
      setSettings(nextSettings);
      setSettingsDraft(nextSettings);
    } catch {
      setSettings(DEFAULT_SETTINGS);
      setSettingsDraft(DEFAULT_SETTINGS);
    }

    try {
      // Clear old localStorage items to force fresh sync from server with stock data
      localStorage.removeItem(STORAGE_KEYS.items);
      setItems(fallbackItems);
      counterRef.current = getNextCounterFromItems(fallbackItems);
    } catch {
      setItems(fallbackItems);
      counterRef.current = getNextCounterFromItems(fallbackItems);
    }

    try {
      const storedUser = localStorage.getItem(STORAGE_KEYS.sessionUser) || "";
      if (storedUser.trim()) {
        setActiveUser(storedUser.trim());
        setShowSessionModal(false);
      } else {
        setShowSessionModal(true);
      }
    } catch {
      setShowSessionModal(true);
    }

    try {
      const rawOperations = localStorage.getItem(STORAGE_KEYS.operations);
      const parsedOperations = rawOperations ? JSON.parse(rawOperations) : [];
      const normalizedQueue = Array.isArray(parsedOperations)
        ? parsedOperations.filter((entry): entry is QueuedOperation => {
            if (!entry || typeof entry !== "object") return false;
            const op = entry as Partial<QueuedOperation>;
            return (
              typeof op.id === "string" &&
              (op.type === "print-invoice" || op.type === "print-label") &&
              Array.isArray(op.itemIds) &&
              typeof op.createdAt === "number"
            );
          })
        : [];
      setOperationQueue(normalizedQueue);
    } catch {
      setOperationQueue([]);
    }

    try {
      const rawMutations = localStorage.getItem(STORAGE_KEYS.mutations);
      const parsedMutations = rawMutations ? JSON.parse(rawMutations) : [];
      const normalizedMutations = Array.isArray(parsedMutations)
        ? parsedMutations.filter((entry): entry is OfflineMutation => {
            if (!entry || typeof entry !== "object") return false;
            const mutation = entry as Partial<OfflineMutation>;
            const isValidType = mutation.type === "create" || mutation.type === "update" || mutation.type === "delete";
            return (
              typeof mutation.id === "string" &&
              isValidType &&
              typeof mutation.itemId === "string" &&
              typeof mutation.createdAt === "number"
            );
          })
        : [];
      setMutationQueue(normalizedMutations);
    } catch {
      setMutationQueue([]);
    }
  }, [normalizeIncomingItems]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(search);
    }, 180);

    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    if (!mounted) return;

    let cancelled = false;

    async function loadServerItems() {
      const serverBefore = await fetchServerItems();
      if (cancelled || serverBefore === null) return;

      try {
        const localItems = readLocalItemsSnapshot();
        if (mutationQueue.length === 0) {
          await mergeMissingLocalIntoServer(serverBefore, localItems);
        }
        const serverAfter = (await fetchServerItems()) || serverBefore;
        if (cancelled) return;

        if (serverAfter.length > 0) {
          setItems(serverAfter);
          counterRef.current = getNextCounterFromItems(serverAfter);
          setLastSyncedAt(Date.now());
          return;
        }

        if (localItems.length > 0) {
          setItems(localItems);
          counterRef.current = getNextCounterFromItems(localItems);
        }
      } catch {
        // keep local fallback when migration check fails
      }
    }

    loadServerItems();

    const intervalId = window.setInterval(async () => {
      if (document.visibilityState !== "visible") return;
      const refreshed = await fetchServerItems();
      if (!refreshed || refreshed.length === 0) return;
      if (cancelled) return;
      setItems(refreshed);
      counterRef.current = getNextCounterFromItems(refreshed);
      setLastSyncedAt(Date.now());
    }, 15000);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [mounted, activeUser, fetchServerItems, mergeMissingLocalIntoServer, readLocalItemsSnapshot, mutationQueue]);

  useEffect(() => {
    if (!mounted) return;

    function handleOnline() {
      setIsOnline(true);
      showToast("Connection restored. Queued operations are ready.");
    }

    function handleOffline() {
      setIsOnline(false);
      showToast("Offline mode: operations will be queued locally.");
    }

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [mounted]);

  useEffect(() => {
    if (!mounted || !isOnline) return;
    if (mutationQueue.length === 0) return;
    void processNextItemMutation();
  }, [mounted, isOnline, mutationQueue, processNextItemMutation]);

  useEffect(() => {
    const existingIds = new Set(items.map((item) => item.id));
    setSelectedItemIds((prev) => prev.filter((id) => existingIds.has(id)));
  }, [items]);

  useEffect(() => {
    if (!panelAction) return;

    if (panelAction === "settings") {
      setSettingsDraft(settings);
      setSettingsOpen(true);
    }

    if (panelAction === "analytics") {
      setShowAnalyticsPopup(true);
    }

    const params = new URLSearchParams(searchParams.toString());
    params.delete("panel");
    const query = params.toString();
    window.history.replaceState({}, "", query ? `/?${query}` : "/");
  }, [panelAction, searchParams, settings]);

  useEffect(() => {
    if (!mounted) return;
    localStorage.setItem(STORAGE_KEYS.settings, JSON.stringify(settings));
  }, [mounted, settings]);

  useEffect(() => {
    if (!mounted) return;
    localStorage.setItem(STORAGE_KEYS.items, JSON.stringify(items));
  }, [mounted, items]);

  useEffect(() => {
    if (!mounted) return;
    localStorage.setItem(STORAGE_KEYS.operations, JSON.stringify(operationQueue));
  }, [mounted, operationQueue]);

  useEffect(() => {
    if (!mounted) return;
    localStorage.setItem(STORAGE_KEYS.mutations, JSON.stringify(mutationQueue));
  }, [mounted, mutationQueue]);

  useEffect(() => {
    if (!mounted) return;
    if (!activeUser.trim()) return;
    localStorage.setItem(STORAGE_KEYS.sessionUser, activeUser.trim());
  }, [mounted, activeUser]);

  function toggleItemSelection(itemId: string) {
    setSelectedItemIds((prev) =>
      prev.includes(itemId)
        ? prev.filter((id) => id !== itemId)
        : [...prev, itemId]
    );
  }

  function clearItemSelection() {
    setSelectedItemIds([]);
  }

  function toggleSelectAllFiltered() {
    const filteredIds = filteredItems.map((item) => item.id);
    const allFilteredSelected =
      filteredIds.length > 0 && filteredIds.every((id) => selectedItemIds.includes(id));

    if (allFilteredSelected) {
      setSelectedItemIds((prev) => prev.filter((id) => !filteredIds.includes(id)));
      return;
    }

    setSelectedItemIds((prev) => Array.from(new Set([...prev, ...filteredIds])));
  }

  function handlePrintSelectedInvoices() {
    if (selectedItemIds.length === 0) {
      showToast("Please select at least one item first");
      return;
    }

    const selectedItems = items.filter((item) => selectedItemIds.includes(item.id));
    if (selectedItems.length === 0) {
      showToast("No selected items found");
      return;
    }

    if (!isOnline) {
      queuePrintOperation("print-invoice", selectedItems.map((item) => item.id));
      showToast("Offline: selected invoices queued for when you are back online.");
      return;
    }

    printInvoices(selectedItems);

    logActivity(`Printed invoices for ${selectedItems.length} item(s)`);
    showToast(`Printed ${selectedItems.length} invoice(s)`);
  }

  function handleItemPrintLabel(item: Item) {
    if (!isOnline) {
      queuePrintOperation("print-label", [item.id]);
      showToast("Offline: label print queued for when you are back online.");
      return;
    }
    printLabels([item]);
    logActivity(`Printed label for ${item.name}`);
    showToast(`Label print opened for ${item.name}`);
  }

  function handlePrintSelectedLabels() {
    if (selectedItemIds.length === 0) {
      showToast("Please select at least one item first");
      return;
    }

    const selectedItems = items.filter((item) => selectedItemIds.includes(item.id));
    if (selectedItems.length === 0) {
      showToast("No selected items found");
      return;
    }

    if (!isOnline) {
      queuePrintOperation("print-label", selectedItems.map((item) => item.id));
      showToast("Offline: selected labels queued for when you are back online.");
      return;
    }

    printLabels(selectedItems);
    logActivity(`Printed labels for ${selectedItems.length} item(s)`);
    showToast(`Printed ${selectedItems.length} label(s)`);
  }

  /* ---------------- ADD ITEM ---------------- */

  function createItem(
    data: AddItemData,
    options?: { openDetails?: boolean; printLabel?: boolean }
  ): Item {
    const code = `KMC-${String(counterRef.current++).padStart(4, "0")}`;
    const user = activeUser.trim() || "unknown";
    const resolvedName = data.name.trim() || "Unnamed item";

    const priceVal = Number(data.price) || 0;
    const widthVal = Number(data.width) || 0;
    const heightVal = Number(data.height) || 0;
    const depthVal = Number(data.depth) || 0;
    const audit = createAuditMetadata(user);

    const newItem: Item = {
      ...data,
      name: resolvedName,
      price: priceVal,
      width: widthVal,
      height: heightVal,
      depth: depthVal,
      id: code,
      code,
      repairs: data.repairs ?? purchaseStatusTemplate(),
      photos: data.photos ?? [],
      dateAdded: new Date().toISOString().split('T')[0],
      sold: false,
      soldAt: null,
      soldBy: null,
      stockCount: 0,
      stockLimit: 10,
      stockUnit: "units",
      stockHistory: [],
      ...audit,
    };

    setItems((prev) => [newItem, ...prev]);

    if (isOnline) {
      void fetch("/api/items", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getSessionHeaders(),
        },
        body: JSON.stringify({
          ...data,
          name: resolvedName,
          price: priceVal,
          width: widthVal,
          height: heightVal,
          depth: depthVal,
          photos: data.photos ?? [],
          repairs: data.repairs ?? purchaseStatusTemplate(),
          sold: false,
          dateAdded: new Date().toISOString().split("T")[0],
        }),
      })
        .then(async (response) => {
          if (!response.ok) throw new Error("CREATE_FAILED");
          const payload = (await response.json()) as { item?: unknown; items?: unknown[] };
          const nextItems = Array.isArray(payload.items) ? normalizeIncomingItems(payload.items) : [];
          if (nextItems.length > 0) {
            setItems(nextItems);
            counterRef.current = getNextCounterFromItems(nextItems);
          }

          if (options?.openDetails && payload.item) {
            const normalizedCreated = normalizeItem(payload.item, purchaseStatusTemplate);
            if (normalizedCreated) {
              setSelectedItem(normalizedCreated);
              setEditMode(false);
            }
          }
        })
        .catch(() => {
          queueItemMutation("create", newItem.id, newItem);
          showToast("Item saved locally. Could not sync to shared server store.");
        });
    } else {
      queueItemMutation("create", newItem.id, newItem);
    }

    setShowAdd(false);
    if (options?.openDetails) {
      setSelectedItem(newItem);
      setEditMode(false);
    }
    if (options?.printLabel) {
      if (!isOnline) {
        queuePrintOperation("print-label", [newItem.id]);
        logActivity(`Queued label print for ${newItem.name}`);
        showToast(`Item created and label queued: ${resolvedName}`);
        return newItem;
      }
      printLabels([newItem]);
      logActivity(`Printed label for ${newItem.name}`);
      showToast(`Item created and label print opened: ${resolvedName}`);
      return newItem;
    }
    const loc = data.location || "(unknown)";
    logActivity(`${resolvedName} has been added to ${loc}`);
    showToast(`Item created: ${resolvedName}`);
    return newItem;
  }

  function updateItem(updated: Item, action = "updated") {
    const user = activeUser.trim() || "unknown";

    const current = items.find((it) => it.id === updated.id);
    if (!current) return;

    const audit = getUpdatedAuditMetadata(current, user, action);
    const updatedWithAudit: Item = {
      ...updated,
      ...audit,
    };

    setItems((prev) =>
      prev.map((it) => {
        if (it.id !== updated.id) return it;
        return updatedWithAudit;
      })
    );
    void syncItemUpdate(updatedWithAudit, "Item update");
    setSelectedItem(null);
    setEditMode(false);
  }

  function toggleItemSold(itemId: string) {
    const current = items.find((it) => it.id === itemId);
    if (!current) return;
    requestToggleSold(itemId, !current.sold);
  }

  /* ---------------- PHOTO MANAGEMENT ---------------- */

  function addPhotos(itemId: string, files: FileList | null) {
    if (!files) return;

    const readers = Array.from(files).map(
      (file) =>
        new Promise<string>((resolve) => {
          const r = new FileReader();
          r.onload = () => resolve(r.result as string);
          r.readAsDataURL(file as Blob);
        })
    );

    Promise.all(readers).then((images) => {
      const current = items.find((entry) => entry.id === itemId);
      if (!current) return;
      const updatedItem: Item = {
        ...current,
        photos: [...current.photos, ...images],
      };

      setItems((prev) => prev.map((it) => (it.id === itemId ? updatedItem : it)));
      void syncItemUpdate(updatedItem, "Photo changes");
    });
  }

  function addPhotoFromCamera(itemId: string, photoDataUrl: string) {
    const current = items.find((entry) => entry.id === itemId);
    if (!current) return;

    const updatedItem: Item = {
      ...current,
      photos: [...current.photos, photoDataUrl],
    };

    setItems((prev) => prev.map((it) => (it.id === itemId ? updatedItem : it)));
    setSelectedItem((prev) => (prev && prev.id === itemId ? updatedItem : prev));
    void syncItemUpdate(updatedItem, "Photo changes");
  }

  /* ---------------- KPI DATA ---------------- */

  const totalValue = items.reduce((s: number, i: Item) => s + i.price, 0);

  const categoryStats = Object.entries(
    items.reduce<Record<string, number>>((acc: Record<string, number>, i: Item) => {
      acc[i.category] = (acc[i.category] || 0) + 1;
      return acc;
    }, {})
  );

  /* ---------------- UI ---------------- */

  function renderHighlightedMatch(text: string, query: string) {
    const parts = getHighlightedParts(text, query);
    return parts.map((part, idx) =>
      part.isMatch ? (
        <mark key={`${part.text}-${idx}`} className="bg-orange-500/30 text-orange-200 rounded px-0.5">
          {part.text}
        </mark>
      ) : (
        <span key={`${part.text}-${idx}`}>{part.text}</span>
      )
    );
  }

  const suggestionBaseItems = useMemo(
    () =>
      items.filter((item: Item) => {
        const matchesCategory = !filterCategory || item.category === filterCategory;
        const matchesLocation = !filterLocation || item.location === filterLocation;
        return matchesCategory && matchesLocation;
      }),
    [items, filterCategory, filterLocation]
  );

  const searchSuggestions = useMemo(
    () =>
      debouncedSearch.trim() === ""
        ? []
        : suggestionBaseItems
            .filter((item) => itemMatchesSearch(item, debouncedSearch))
            .slice(0, 8)
            .map((item) => ({
              item,
              lines: getItemSuggestionLines(item, debouncedSearch, formatEuro),
            })),
    [debouncedSearch, suggestionBaseItems]
  );

  // Filtered, searched, and sorted items
  const filteredItems = useMemo(() => {
    const filtered = items.filter((item: Item) => {
      const matchesSearch = itemMatchesSearch(item, debouncedSearch);
      const matchesCategory = !filterCategory || item.category === filterCategory;
      const matchesLocation = !filterLocation || item.location === filterLocation;
      return matchesSearch && matchesCategory && matchesLocation;
    });

    return sortItemsSoldLast(filtered, sortField, sortDir);
  }, [items, debouncedSearch, filterCategory, filterLocation, sortField, sortDir]);

  const selectedCount = selectedItemIds.length;
  const filteredItemIds = filteredItems.map((item) => item.id);
  const allFilteredSelected =
    filteredItemIds.length > 0 && filteredItemIds.every((id) => selectedItemIds.includes(id));

  useEffect(() => {
    if (!mounted) return;
    void runSyncNow({ announce: false });
  }, [mounted]);
  const soldConfirmationItem = soldConfirmationItemId
    ? items.find((entry) => entry.id === soldConfirmationItemId) || null
    : null;

  if (!mounted) return null;

  return (
    <div className="app-shell h-dvh min-h-0 bg-background text-foreground p-3 md:p-6 overflow-hidden flex flex-col overscroll-none">
      {/* HEADER */}
      <div className="flex justify-between items-center mb-4 md:mb-6 shrink-0 gap-2">
        <div>
          <h1 className="hidden md:block text-xl font-bold text-orange-500">
            Kim&apos;s Chocolate — Packing Materials System
          </h1>
        </div>

        <div className="flex gap-2 md:gap-3 flex-wrap md:flex-nowrap w-full md:w-auto justify-end">
          <button
            onClick={() => setShowAdd(true)}
            className="bg-orange-500 hover:bg-orange-400 px-4 md:px-5 py-2 rounded-xl font-semibold text-black text-sm md:text-base"
            aria-label="Add New Packing Material"
            tabIndex={0}
            title="Add New Packing Material"
          >
            + Add Packing Material
          </button>
          <button
            onClick={() => setShowSessionModal(true)}
            className="hidden md:inline-flex bg-zinc-800 hover:bg-zinc-700 px-4 py-2 rounded-xl border border-zinc-700 text-sm"
            aria-label="Switch user"
            title="Switch user"
          >
            👤 {activeUser.trim() || "No user"}
          </button>
                    {/* TOAST NOTIFICATION */}
                    {toast && (
                      <div
                        className="fixed top-6 right-6 z-50 bg-zinc-900 text-white px-6 py-3 rounded-xl shadow-lg border border-orange-500 animate-fade-in"
                        role="status"
                        aria-live="polite"
                      >
                        {toast}
                      </div>
                    )}
        </div>
      </div>

      {/* SEARCH, FILTERS, SORT & EXPORT */}
      <div className="flex gap-2 md:gap-3 mb-4 md:mb-6 flex-wrap items-center shrink-0">
        {/* Sync Controls */}
        <div className="flex items-center gap-1">
          <button
            className={`px-3 py-1.5 rounded text-xs font-medium border ${
              syncBusy
                ? "bg-zinc-800 text-zinc-400 border-zinc-700"
                : "bg-zinc-800 text-sky-300 hover:bg-zinc-700 border-sky-700"
            }`}
            onClick={() => {
              void runSyncNow({ announce: true });
            }}
            disabled={syncBusy}
          >
            {syncBusy ? "Syncing..." : "🔄 Sync"}
          </button>
          <span
            className="inline-flex items-center justify-center w-4 h-4"
            title={
              syncHealth.lastRequestId
                ? `Sync status: ${syncHealth.lastStatus}. Last request: ${syncHealth.lastRequestId}`
                : `Sync status: ${syncHealth.lastStatus}`
            }
            aria-label={`Sync status ${syncHealth.lastStatus}`}
          >
            {syncBusy || syncHealth.lastStatus !== "ok" ? (
              <span className="w-3 h-3 rounded-full border-2 border-orange-400 border-t-transparent animate-spin" />
            ) : (
              <span className="text-emerald-400 text-sm leading-none">✓</span>
            )}
          </span>
        </div>

        {/* Search */}
        <div className="relative flex-1 min-w-0 md:flex-none md:w-64">
          <input
            type="text"
            placeholder="Search items..."
            className="w-full px-3 py-1.5 text-sm rounded bg-zinc-800 border border-zinc-700"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => {
              setTimeout(() => setSearchFocused(false), 120);
            }}
          />

          {searchFocused && searchSuggestions.length > 0 && (
            <div className="absolute top-full mt-2 z-40 w-full max-h-80 overflow-y-auto rounded-xl border border-zinc-700 bg-zinc-900 shadow-2xl">
              {searchSuggestions.map(({ item, lines }) => (
                <button
                  key={`suggest-${item.id}`}
                  type="button"
                  className="w-full text-left px-3 py-2 border-b border-zinc-800 last:border-b-0 hover:bg-zinc-800/70 transition-colors"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    setSelectedItem(item);
                    setEditMode(false);
                    setSearchFocused(false);
                  }}
                >
                  <div className="text-sm font-medium text-zinc-100 truncate">{item.name}</div>
                  <div className="mt-1 space-y-0.5">
                    {(lines.length > 0 ? lines : [{ label: "Code", value: item.code }])
                      .slice(0, 2)
                      .map((line, idx) => (
                        <div key={`${item.id}-${line.label}-${idx}`} className="text-xs text-zinc-400 truncate">
                          <span className="text-zinc-500">{line.label}:</span>{" "}
                          {renderHighlightedMatch(line.value, debouncedSearch)}
                        </div>
                      ))}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Filters & Sort */}
        <div className="flex items-center gap-1">
          <select
            className="px-2 py-1.5 text-xs rounded bg-zinc-800 border border-zinc-700"
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
          >
            <option value="">All Categories</option>
            {ADD_ITEM_CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>

          <select
            className="px-2 py-1.5 text-xs rounded bg-zinc-800 border border-zinc-700"
            value={filterLocation}
            onChange={(e) => setFilterLocation(e.target.value)}
          >
            <option value="">All Locations</option>
            {ADD_ITEM_LOCATIONS.map((loc) => (
              <option key={loc} value={loc}>{loc}</option>
            ))}
          </select>

          <select
            className="px-2 py-1.5 text-xs rounded bg-zinc-800 border border-zinc-700"
            value={sortField}
            onChange={(e) => setSortField(e.target.value)}
          >
            <option value="">Sort by…</option>
            <option value="status">Status</option>
            <option value="dateAdded">Date</option>
            <option value="name">Name</option>
            <option value="price">Price</option>
          </select>

          <button
            className="px-2 py-1.5 rounded bg-zinc-800 border border-zinc-700 hover:bg-zinc-700"
            onClick={() => setSortDir((d) => (d === "asc" ? "desc" : "asc"))}
            title="Toggle sort direction"
          >
            {sortDir === "asc" ? "↑" : "↓"}
          </button>
        </div>

        {/* Status Indicators */}
        <div className="flex items-center gap-1 ml-auto md:ml-0">
          <span
            className={`px-2 py-1 rounded text-xs font-medium border ${
              isOnline
                ? "bg-emerald-950/40 text-emerald-300 border-emerald-800"
                : "bg-amber-950/40 text-amber-300 border-amber-800"
            }`}
          >
            {isOnline ? "Online" : "Offline"}
          </span>

          {selectedCount > 0 && (
            <div className="flex items-center gap-1">
              <button
                className="px-2 py-1.5 rounded text-xs font-medium bg-orange-500 text-black hover:bg-orange-400 border border-orange-400"
                onClick={handlePrintSelectedInvoices}
              >
                🖨️ Invoices ({selectedCount})
              </button>
              <button
                className="px-2 py-1.5 rounded text-xs font-medium bg-zinc-700 text-white hover:bg-zinc-600 border border-zinc-500"
                onClick={handlePrintSelectedLabels}
              >
                🏷️ Labels ({selectedCount})
              </button>
            </div>
          )}
        </div>
      </div>

      {/* CONTENT */}
      <div ref={itemsScrollRef} className="flex-1 min-h-0 overflow-y-auto pr-0 md:pr-1 overscroll-contain">
        {activeView === "items" ? (
          <div className="space-y-2 pb-6">
            {filteredItems.length === 0 && (
              <div className="w-full rounded-xl border border-zinc-700 bg-zinc-900 p-4 text-sm text-zinc-400">
                No items match your current search or filters.
              </div>
            )}
            {filteredItems.map((item) => {
              const status = getItemStatus(item);
              const isSold = status === "Sold";
              const isCriticalStock = item.stockCount <= item.stockLimit / 2;
              const isLowStock = item.stockCount < item.stockLimit;
              return (
                <div
                  key={item.id}
                  ref={(node) => setItemCardRef(item.id, node)}
                  onClick={(event) => {
                    if (isInteractiveTarget(event.target)) return;
                    selectItemFromCard(item);
                  }}
                  onDoubleClick={(event) => {
                    if (isInteractiveTarget(event.target)) return;
                    setSelectedItem(item);
                    setEditMode(false);
                  }}
                  className={`w-full rounded-xl border px-4 py-3 ${
                    isCriticalStock
                      ? "bg-zinc-900/60 border-red-900"
                      : isLowStock
                      ? "bg-zinc-900/50 border-yellow-900"
                      : "bg-zinc-900 border-zinc-700"
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-3 min-w-0">
                      <input
                        type="checkbox"
                        checked={selectedItemIds.includes(item.id)}
                        onChange={() => toggleItemSelection(item.id)}
                        className="h-4 w-4 appearance-none rounded border border-zinc-700 bg-zinc-900 checked:bg-zinc-600 checked:border-zinc-600"
                      />
                      <div className="min-w-0">
                        <div className="font-medium text-white truncate">{item.name}</div>
                        <button
                          type="button"
                          onClick={() => {
                            void copyItemCode(item.code);
                          }}
                          className="text-xs text-zinc-500 hover:text-zinc-300"
                          title="Copy item code"
                        >
                          {item.code}
                        </button>
                        <span className="text-xs text-zinc-500"> • {item.category}</span>
                      </div>
                    </div>
                    {/* Stock Indicator */}
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-zinc-700 bg-zinc-800/50">
                      <div
                        className={`w-2 h-2 rounded-full ${
                          item.stockCount <= item.stockLimit / 2
                            ? "bg-red-500 stock-indicator-critical"
                            : item.stockCount < item.stockLimit
                            ? "bg-yellow-500 stock-indicator-low"
                            : "bg-green-500"
                        }`}
                      />
                      <div className="text-xs font-medium">
                        <span className="text-zinc-300">Stock:</span> <span className="text-white font-semibold">{item.stockCount}</span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-2 grid grid-cols-2 md:grid-cols-5 gap-2 text-xs text-zinc-300">
                    <div><span className="text-zinc-500">Date:</span> {item.dateAdded}</div>
                    <div><span className="text-zinc-500">Price:</span> {formatEuro(item.price)}</div>
                    <div><span className="text-zinc-500">Location:</span> {item.location}</div>
                    <div className="hidden md:block"><span className="text-zinc-500">Dimensions:</span> {item.width}×{item.height}×{item.depth} cm</div>
                    <div><span className="text-zinc-500">Condition:</span> {item.condition}</div>
                    <div className="col-span-2 md:col-span-1"><span className="text-zinc-500">Repair:</span> {getExactRepairOverview(item)}</div>
                  </div>

                  {/* Miniature Stock Visualization */}
                  <div className="mt-3 flex items-center gap-3">
                    <div className="text-xs text-zinc-500">Stock:</div>
                    <div className="flex-1 relative">
                      <div className="h-6 bg-zinc-800 rounded flex items-end">
                        {/* Stock bar */}
                        <div
                          className={`h-full rounded-l transition-colors ${
                            item.stockCount < item.stockLimit ? "bg-red-600" : "bg-green-600"
                          }`}
                          style={{
                            width: `${Math.min((item.stockCount / Math.max(item.stockCount, item.stockLimit * 1.5)) * 100, 100)}%`,
                            minWidth: "4px"
                          }}
                          title={`Current: ${item.stockCount} ${item.stockUnit}`}
                        />
                        {/* Orange limit line */}
                        <div
                          className="absolute top-0 bottom-0 w-0.5 bg-orange-500"
                          style={{
                            left: `${Math.min((item.stockLimit / Math.max(item.stockCount, item.stockLimit * 1.5)) * 100, 100)}%`
                          }}
                          title={`Limit: ${item.stockLimit} ${item.stockUnit}`}
                        />
                      </div>
                      <div className="text-xs text-zinc-400 mt-1">
                        {item.stockCount} / {item.stockLimit} {item.stockUnit}
                      </div>
                    </div>
                  </div>

                  <div className="mt-2 flex flex-wrap gap-2">
                    <button
                      className="bg-zinc-700 px-2.5 py-1 rounded-lg text-xs"
                      onClick={() => {
                        setSelectedItem(item);
                        setEditMode(false);
                      }}
                    >
                      Details
                    </button>
                    <button
                      className="hidden md:inline-flex bg-zinc-700 px-2.5 py-1 rounded-lg text-xs"
                      onClick={() => handleItemInvoiceClick(item)}
                    >
                      Invoice
                    </button>
                    <button
                      className="hidden md:inline-flex bg-zinc-700 px-2.5 py-1 rounded-lg text-xs"
                      onClick={() => handleItemPrintLabel(item)}
                    >
                      Label
                    </button>
                    <button
                      className="bg-blue-600 hover:bg-blue-700 px-2.5 py-1 rounded-lg text-xs text-white"
                      onClick={() => toggleItemSold(item.id)}
                    >
                      Order
                    </button>
                    <label className="bg-orange-500 px-2.5 py-1 rounded-lg cursor-pointer text-black text-xs">
                      Photo
                      <input
                        type="file"
                        multiple
                        hidden
                        onChange={(e) => addPhotos(item.id, e.target.files)}
                      />
                    </label>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-5 pb-6">
            {filteredItems.length === 0 && (
              <div className="col-span-3 rounded-xl border border-zinc-700 bg-zinc-900 p-5 text-sm text-zinc-400">
                No items found. Try adjusting your search text or filters.
              </div>
            )}
            {filteredItems.map((item) => {
              const allRepairsDone = item.repairs.every((r) => r.done);
              const compactRepair = getExactRepairOverview(item);
              const isSold = item.sold;
              return (
                <div
                  key={item.id}
                  ref={(node) => setItemCardRef(item.id, node)}
                  onClick={(event) => {
                    if (isInteractiveTarget(event.target)) return;
                    selectItemFromCard(item);
                  }}
                  onDoubleClick={(event) => {
                    if (isInteractiveTarget(event.target)) return;
                    setSelectedItem(item);
                    setEditMode(false);
                  }}
                  className={`p-5 rounded-2xl border transition-all duration-500 ${
                    isSold
                      ? "bg-zinc-900/60 border-zinc-800 opacity-70"
                      : allRepairsDone
                      ? "bg-gradient-to-br from-zinc-700 to-zinc-800 border-orange-500"
                      : "bg-zinc-900 border-zinc-700"
                  }`}
                >
              <button
                type="button"
                onClick={() => {
                  void copyItemCode(item.code);
                }}
                className="text-[11px] tracking-wide uppercase text-zinc-500 hover:text-zinc-300"
                title="Copy item code"
              >
                {item.code}
              </button>
              <div className="mt-2">
                <label className="inline-flex items-center gap-2 text-sm text-zinc-500 hover:text-zinc-400 cursor-pointer transition-colors">
                  <input
                    type="checkbox"
                    checked={selectedItemIds.includes(item.id)}
                    onChange={() => toggleItemSelection(item.id)}
                    className="h-4 w-4 appearance-none rounded border border-zinc-700 bg-zinc-900 checked:bg-zinc-600 checked:border-zinc-600"
                  />
                  Select item
                </label>
              </div>
              <div className="text-xl">{item.name}</div>
              <div className="text-sm text-zinc-400 mt-2">
                {item.location} • {item.width}×{item.height}×{item.depth} cm
              </div>
              <div className="text-lg mt-2">{formatEuro(item.price)}</div>
              {/* REPAIR FLOW */}
              <div className="hidden md:flex flex-wrap gap-2 mt-4">
                {item.repairs.map((s, i) => {
                  const isRepairStep = s.name === "Repair";
                  const bgClass = s.done ? "bg-green-900 hover:bg-green-800" : "bg-orange-900 hover:bg-orange-800";
                  let displayText = s.name;
                  let symbol = s.done ? "✓" : "○";
                  if (isRepairStep) {
                    const st = (s as RepairStep).state || "none";
                    switch (st) {
                      case "none":
                        displayText = "Repair";
                        symbol = "○";
                        break;
                      case "noNeed":
                        displayText = "No repair needed";
                        symbol = "✓";
                        break;
                      case "inProgress":
                        displayText = "Being repaired";
                        symbol = "…";
                        break;
                      case "repaired":
                        displayText = "Repaired";
                        symbol = "✓";
                        break;
                    }
                  }

                  let textClass2 = s.done ? "text-green-200" : "text-orange-200";
                  if (isRepairStep) {
                    const st = (s as RepairStep).state || "none";
                    if (st === "noNeed") textClass2 = "text-green-200";
                    else if (st === "inProgress" || st === "repaired") textClass2 = "text-orange-400";
                    else textClass2 = "text-orange-200";
                  }

                  return (
                    <button
                      key={i}
                      className={`px-3 py-1 rounded-full text-xs font-semibold hover:opacity-80 transition-all cursor-pointer focus:outline-none ${bgClass} ${textClass2}`}
                      onClick={() => toggleRepairStep(item.id, i)}
                      title={isRepairStep ? "Click to cycle Repair state" : "Click to toggle repair step"}
                    >
                      {displayText}: {symbol}
                    </button>
                  );
                })}
                {/* Stock Indicator (replaces Sold button) */}
                <div className="px-3 py-1 rounded-full border border-zinc-700 bg-zinc-800/50 flex items-center gap-2">
                  <div
                    className={`w-2 h-2 rounded-full ${
                      item.stockCount <= item.stockLimit / 2
                        ? "bg-red-500 stock-indicator-critical"
                        : item.stockCount < item.stockLimit
                        ? "bg-yellow-500 stock-indicator-low"
                        : "bg-green-500"
                    }`}
                  />
                  <div className="text-xs font-medium">
                    <span className="text-zinc-300">Stok:</span> <span className="text-white font-semibold">{item.stockCount}</span>
                  </div>
                </div>
              </div>
              <div className="md:hidden text-xs text-zinc-300 mt-3">
                <span className="text-zinc-500">Repair:</span> {compactRepair}
              </div>
              {/* PHOTOS */}
              <div className="flex gap-2 mt-4 overflow-x-auto">
                {item.photos.map((p, i) => (
                  <Image
                    key={i}
                    src={p}
                    width={64}
                    height={64}
                    unoptimized
                    alt={`Item photo ${i + 1}`}
                    className="h-16 w-16 object-cover rounded cursor-pointer border-2 border-transparent hover:border-orange-500"
                    onClick={() => setLightbox({ item, photoIdx: i })}
                    title="Click to enlarge"
                  />
                ))}
              </div>
              {/* ACTIONS */}
              <div className="flex gap-2 mt-4">
                <label className="bg-orange-500 px-3 py-1 rounded-lg cursor-pointer text-black text-sm">
                  Photo
                  <input
                    type="file"
                    multiple
                    hidden
                    onChange={(e) => addPhotos(item.id, e.target.files)}
                  />
                </label>
                <button
                  className="bg-zinc-700 px-3 py-1 rounded-lg text-sm"
                  onClick={() => {
                    setSelectedItem(item);
                    setEditMode(false);
                  }}
                >
                  Details
                </button>
                <button
                  className="hidden md:inline-flex bg-zinc-700 px-3 py-1 rounded-lg text-sm"
                  onClick={() => handleItemInvoiceClick(item)}
                >
                  Invoice
                </button>
                <button
                  className="hidden md:inline-flex bg-zinc-700 px-3 py-1 rounded-lg text-sm"
                  onClick={() => handleItemPrintLabel(item)}
                >
                  Label
                </button>
              </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ADD ITEM MODAL */}
      {showAdd && (
        <AddItemModal
          previewCode={`KMC-${String(counterRef.current).padStart(4, "0")}`}
          onCancel={() => setShowAdd(false)}
          onCreate={createItem}
        />
      )}

      {showCamera && (
        <CameraCaptureModal
          existingItems={items}
          onCancel={() => setShowCamera(false)}
          onCreateFromCamera={(data, options) => {
            createItem(data, { openDetails: true, printLabel: options?.printLabel });
            setShowCamera(false);
          }}
        />
      )}

      {/* KPI MODAL */}
      {showKPI && (
        <KpiModal
          totalValue={totalValue}
          categoryStats={categoryStats}
          onClose={() => setShowKPI(false)}
        />
      )}

      {showAnalyticsPopup && (
        <AnalyticsModal
          totalItems={items.length}
          soldItems={items.filter((item) => item.sold).length}
          totalValue={totalValue}
          categoryStats={categoryStats}
          onClose={() => setShowAnalyticsPopup(false)}
        />
      )}

      {/* PHOTO LIGHTBOX */}
      {lightbox && (
        <PhotoLightbox
          item={lightbox.item}
          photoIdx={lightbox.photoIdx}
          onClose={() => setLightbox(null)}
          onPrev={() => setLightbox((prev) => prev ? { ...prev, photoIdx: prev.photoIdx - 1 } : null)}
          onNext={() => setLightbox((prev) => prev ? { ...prev, photoIdx: prev.photoIdx + 1 } : null)}
        />
      )}

      {/* ITEM DETAILS MODAL */}
      {selectedItem && (
        <ItemDetailsModal
          key={`${selectedItem.id}-${editMode ? "edit" : "view"}`}
          item={selectedItem}
          editMode={editMode}
          onClose={() => setSelectedItem(null)}
          onEdit={() => setEditMode(true)}
          onCancelEdit={() => setEditMode(false)}
          onSave={(updatedItem) => updateItemWithUndo(updatedItem)}
          onDelete={() => deleteItem(selectedItem.id)}
          onToggleSold={(nextSold) => requestToggleSold(selectedItem.id, nextSold)}
          onAddPhoto={(photoDataUrl) => addPhotoFromCamera(selectedItem.id, photoDataUrl)}
          onOpenPhoto={(photoIdx) => {
            if (selectedItem.photos[photoIdx]) {
              setLightbox({ item: selectedItem, photoIdx });
            } else {
              showToast("Photo not found");
            }
          }}
          onAddLog={addLog}
          onRemoveLog={removeLog}
        />
      )}

      {soldConfirmationItem && (
        <div
          className="fixed inset-0 z-[95] bg-black/80 flex items-center justify-center p-4"
          onClick={() => setSoldConfirmationItemId(null)}
        >
          <div
            className="w-full max-w-md rounded-xl border border-zinc-700 bg-zinc-900 p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-base font-semibold text-orange-300 mb-2">Confirm Sale</h3>
            <div className="text-sm text-zinc-300 space-y-1 mb-4">
              <div>
                <span className="text-zinc-500">Item:</span> <span className="text-white">{soldConfirmationItem.name}</span>
              </div>
              <div>
                <span className="text-zinc-500">Code:</span> {soldConfirmationItem.code}
              </div>
              <div>
                <span className="text-zinc-500">Price:</span> {formatEuro(soldConfirmationItem.price)}
              </div>
              <div>
                <span className="text-zinc-500">Repair:</span> {getExactRepairOverview(soldConfirmationItem)}
              </div>
            </div>
            <p className="text-sm text-zinc-200 mb-4">Is this item sold?</p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setSoldConfirmationItemId(null)}
                className="flex-1 rounded-lg bg-zinc-700 hover:bg-zinc-600 text-white py-2"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmSoldToggle}
                className="flex-1 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white font-semibold py-2"
              >
                Sold
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SETTINGS SIDEBAR */}
      <SettingsSidebar
        open={settingsOpen}
        draft={settingsDraft}
        onDraftChange={handleSettingsDraftChange}
        onSaveCompany={handleSaveCompanyInfo}
        onCancelCompany={handleCancelCompanyInfo}
        onSaveInvoice={handleSaveInvoiceTemplate}
        onCancelInvoice={handleCancelInvoiceTemplate}
        onSavePreferences={handleSaveAppPreferences}
        onCancelPreferences={handleCancelAppPreferences}
        debugInfo={{
          activeUser: activeUser.trim() || "unknown",
          isOnline,
          itemCount: items.length,
          queuedOperations: operationQueue.length,
          lastSyncedAt,
          syncHealth,
        }}
        onRunSyncNow={() => {
          void runSyncNow({ announce: true });
        }}
        onCopyLastRequestId={() => {
          void copyLastSyncRequestId();
        }}
        onCopyTechnicalSnapshot={() => {
          void copyTechnicalSnapshot();
        }}
        onResetSyncErrors={resetSyncErrorCounter}
        onClose={() => setSettingsOpen(false)}
      />

      {/* INVOICE PREVIEW MODAL */}
      {invoicePreviewItem && (
        <InvoicePreviewModal
          item={invoicePreviewItem}
          settings={settings}
          onClose={() => setInvoicePreviewItem(null)}
          onSave={handleInvoiceSavePDF}
          onPrint={handleInvoicePrint}
          onMail={handleInvoiceMail}
        />
      )}

      {showSessionModal && (
        <SessionModal
          currentUser={activeUser}
          canClose={Boolean(activeUser.trim())}
          onClose={() => {
            if (!activeUser.trim()) return;
            setShowSessionModal(false);
          }}
          onSave={(nextUser) => {
            setActiveUser(nextUser);
            setShowSessionModal(false);
            showToast(`Active session: ${nextUser}`);
            void runSyncNow({ announce: true });
          }}
        />
      )}
    </div>
  );
}

export default function Page() {
  return (
    <Suspense fallback={null}>
      <PageContent />
    </Suspense>
  );
}

// PhotoLightbox component (move to top-level scope)
function PhotoLightbox(props: PhotoLightboxProps) {
  const { item, photoIdx, onClose, onPrev, onNext } = props;
  if (!item.photos[photoIdx]) return null;

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[80] backdrop-blur-sm p-4" onClick={onClose}>
      <div className="relative w-full h-full flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
        {/* Image */}
        <Image
          src={item.photos[photoIdx]}
          width={1600}
          height={1200}
          unoptimized
          className="max-h-[75vh] max-w-[90vw] rounded-lg shadow-2xl border-4 border-orange-500 object-contain mx-auto"
          alt={`Photo ${photoIdx + 1} of ${item.photos.length}`}
        />
        
        {/* Photo Counter */}
        <div className="absolute bottom-4 left-4 bg-zinc-900/90 text-white px-3 py-1 rounded-lg text-sm">
          {photoIdx + 1} / {item.photos.length}
        </div>

        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-2 right-2 bg-red-600 hover:bg-red-700 text-white rounded-full w-10 h-10 flex items-center justify-center text-xl transition-colors"
          aria-label="Close"
          title="Close (Esc)"
        >
          ✕
        </button>

        {/* Previous Button */}
        <button
          onClick={onPrev}
          disabled={photoIdx === 0}
          className="absolute left-2 top-1/2 -translate-y-1/2 bg-zinc-900/90 hover:bg-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-full w-12 h-12 flex items-center justify-center text-2xl transition-colors"
          aria-label="Previous photo"
          title="Previous (←)"
        >
          ‹
        </button>

        {/* Next Button */}
        <button
          onClick={onNext}
          disabled={photoIdx === item.photos.length - 1}
          className="absolute right-2 top-1/2 -translate-y-1/2 bg-zinc-900/90 hover:bg-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-full w-12 h-12 flex items-center justify-center text-2xl transition-colors"
          aria-label="Next photo"
          title="Next (→)"
        >
          ›
        </button>
      </div>
    </div>
  );
}

/* ---------------- ADD ITEM MODAL ---------------- */

function SessionModal({
  currentUser,
  canClose,
  onClose,
  onSave,
}: {
  currentUser: string;
  canClose: boolean;
  onClose: () => void;
  onSave: (user: string) => void;
}) {
  const [name, setName] = useState(currentUser || "");
  const presetUsers = ["Intake Desk", "Workshop", "Floor Team", "Admin"];

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4" onClick={canClose ? onClose : undefined}>
      <div className="w-full max-w-md rounded-2xl border border-zinc-700 bg-zinc-900 p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-orange-400">Choose Session User</h2>
          {canClose && (
            <button onClick={onClose} className="text-zinc-400 hover:text-orange-400 text-xl" aria-label="Close session modal">
              ✕
            </button>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2 mb-3">
          {presetUsers.map((user) => (
            <button
              key={user}
              onClick={() => setName(user)}
              className={`px-3 py-2 rounded border text-sm ${
                name === user
                  ? "bg-orange-500 text-black border-orange-400"
                  : "bg-zinc-800 text-zinc-200 border-zinc-700 hover:bg-zinc-700"
              }`}
            >
              {user}
            </button>
          ))}
        </div>

        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Enter your name"
          className="w-full p-2 rounded bg-zinc-800 border border-zinc-700 mb-3"
        />

        <button
          onClick={() => {
            const trimmed = name.trim();
            if (!trimmed) return;
            onSave(trimmed);
          }}
          disabled={!name.trim()}
          className={`w-full py-2 rounded font-semibold ${
            name.trim()
              ? "bg-orange-500 text-black hover:bg-orange-400"
              : "bg-zinc-700 text-zinc-400 cursor-not-allowed"
          }`}
        >
          Start Session
        </button>
      </div>
    </div>
  );
}

function SimpleCameraModal({
  onClose,
  onCapture,
  title,
}: {
  onClose: () => void;
  onCapture: (photoDataUrl: string) => void;
  title?: string;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [cameraError, setCameraError] = useState<string>("");
  const [capturePulse, setCapturePulse] = useState(false);
  const [freezeFrame, setFreezeFrame] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false })
      .then((stream) => {
        if (!active) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          void videoRef.current.play().catch(() => {
            setCameraError("Could not start camera preview.");
          });
        }
      })
      .catch(() => {
        setCameraError("Camera access was denied or is not available.");
      });

    return () => {
      active = false;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
    };
  }, []);

  const takePhoto = () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth || !video.videoHeight) return;

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const imageData = canvas.toDataURL("image/jpeg", 0.85);
    onCapture(imageData);
    setFreezeFrame(imageData);
    setCapturePulse(true);
    window.setTimeout(() => setCapturePulse(false), 160);
    window.setTimeout(() => setFreezeFrame(null), 700);
  };

  return (
    <div className="fixed inset-0 z-[90] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div className="w-full max-w-xl rounded-2xl border border-zinc-700 bg-zinc-900 p-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-orange-400">{title || "Add photos"}</h3>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-zinc-800 hover:bg-zinc-700 text-zinc-200"
            aria-label="Close camera"
          >
            ✕
          </button>
        </div>

        <div className="rounded-xl overflow-hidden border border-zinc-700 bg-black">
          {cameraError ? (
            <div className="p-4 text-sm text-rose-300">{cameraError}</div>
          ) : (
            <button
              type="button"
              onClick={takePhoto}
              className="w-full h-[22rem] relative text-left"
              title="Tap anywhere to capture"
              aria-label="Tap camera view to capture photo"
            >
              <video ref={videoRef} className="w-full h-[22rem] object-cover" autoPlay muted playsInline />
              <div className="pointer-events-none absolute inset-0">
                {freezeFrame && (
                  <div className="absolute inset-0 bg-center bg-cover" style={{ backgroundImage: `url(${freezeFrame})` }} />
                )}
                <div className="absolute inset-0 grid grid-cols-3 grid-rows-3">
                  {Array.from({ length: 9 }).map((_, i) => (
                    <span key={`simple-grid-${i}`} className="border border-white/15" />
                  ))}
                </div>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-white/70 text-6xl font-light leading-none">+</span>
                </div>
                <div className={`absolute left-0 right-0 top-0 h-10 bg-black/70 transition-transform duration-150 ${capturePulse ? "translate-y-0" : "-translate-y-full"}`} />
                <div className={`absolute left-0 right-0 bottom-0 h-10 bg-black/70 transition-transform duration-150 ${capturePulse ? "translate-y-0" : "translate-y-full"}`} />
                {capturePulse && <div className="absolute inset-0 bg-white/20" />}
              </div>
            </button>
          )}
        </div>

        <div className="text-xs text-zinc-400 mt-2">Tap anywhere on the camera grid to capture a photo.</div>

        <div className="flex gap-2 mt-3">
          <button type="button" onClick={onClose} className="rounded-lg bg-zinc-700 hover:bg-zinc-600 text-white px-4 py-2">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

function EditablePhotoStrip({
  photos,
  onRemove,
  onAdd,
}: {
  photos: string[];
  onRemove: (idx: number) => void;
  onAdd: () => void;
}) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1">
      {photos.map((photo, idx) => (
        <div key={`editable-photo-${idx}`} className="relative shrink-0">
          <Image
            src={photo}
            width={96}
            height={96}
            unoptimized
            alt={`Item photo ${idx + 1}`}
            className="w-24 h-24 object-cover rounded border border-zinc-700"
          />
          <button
            type="button"
            onClick={() => onRemove(idx)}
            className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold"
            aria-label={`Delete photo ${idx + 1}`}
            title="Delete photo"
          >
            ×
          </button>
        </div>
      ))}

      <button
        type="button"
        onClick={onAdd}
        className="w-24 h-24 shrink-0 rounded border border-dashed border-zinc-500 hover:border-orange-400 text-zinc-300 hover:text-orange-300 text-xs p-2"
      >
        Add photos
      </button>
    </div>
  );
}

type AddItemData = {
  name: string;
  category: string;
  price: number | string;
  location: string;
  repairLocation: string;
  width: number | string;
  height: number | string;
  depth: number | string;
  condition: "Excellent" | "Good" | "Fair" | "Poor";
  damageDescription: string;
  notes: string;
  brand: string;
  year: number;
  material: string;
  photos?: string[];
  repairs?: RepairStep[];
  stockCount?: number;
  stockLimit?: number;
  stockUnit?: string;
  stockHistory?: Array<{ date: string; count: number }>;
};

function AddItemModal({
  previewCode,
  onCancel,
  onCreate,
}: {
  previewCode: string;
  onCancel: () => void;
  onCreate: (data: AddItemData) => void;
}) {
  const [form, setForm] = useState<AddItemData>({
    name: "",
    category: ADD_ITEM_CATEGORIES[0],
    price: "",
    location: ADD_ITEM_LOCATIONS[0],
    repairLocation: "",
    width: "",
    height: "",
    depth: "",
    condition: "Good" as const,
    damageDescription: "",
    notes: "",
    brand: "",
    year: new Date().getFullYear(),
    material: "",
    photos: [],
    repairs: purchaseStatusTemplate(),
    stockCount: 0,
    stockLimit: 10,
    stockUnit: "units",
    stockHistory: [],
  });

  const nameRef = useRef<HTMLInputElement | null>(null);
  const [showCameraModal, setShowCameraModal] = useState(false);
  const [errors, setErrors] = useState<{ name?: string; price?: string; width?: string; height?: string; depth?: string; year?: string }>({});

  useEffect(() => {
    nameRef.current?.focus();
  }, []);

  const conditionColors = {
    Excellent: "text-green-400 bg-green-900/20",
    Good: "text-blue-400 bg-blue-900/20",
    Fair: "text-yellow-400 bg-yellow-900/20",
    Poor: "text-red-400 bg-red-900/20",
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 overflow-y-auto" onClick={onCancel}>
      <div className="bg-zinc-900 rounded-2xl max-w-2xl w-full mx-4 my-6 relative" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-start p-6 border-b border-zinc-700">
          <div>
            <div className="text-xs text-zinc-500">{previewCode}</div>
            <h2 className="text-2xl font-bold text-orange-500">{form.name.trim() || "New item"}</h2>
          </div>
          <button onClick={onCancel} className="text-2xl hover:text-orange-500" aria-label="Close">
            ✕
          </button>
        </div>

        <div className="p-6 max-h-[70vh] overflow-y-auto space-y-6">
          <div>
            <div className="text-sm text-zinc-400 mb-2">Photos ({form.photos?.length || 0})</div>
            <EditablePhotoStrip
              photos={form.photos ?? []}
              onRemove={(idx) => {
                setForm((prev) => ({ ...prev, photos: (prev.photos ?? []).filter((_, i) => i !== idx) }));
              }}
              onAdd={() => setShowCameraModal(true)}
            />
          </div>

          <div>
            <div className="text-xs text-zinc-500">Name</div>
            <input
              ref={nameRef}
              type="text"
              value={form.name}
              onChange={(e) => {
                setForm({ ...form, name: e.target.value });
                if (errors.name) setErrors((s) => ({ ...s, name: undefined }));
              }}
              className="w-full bg-zinc-800 border border-zinc-700 rounded px-2 py-1 mt-1 text-white"
              placeholder="Packing material name"
            />
            {errors.name && <div className="text-rose-400 text-xs mt-1">{errors.name}</div>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-xs text-zinc-500">Category</div>
              <select
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                className="w-full bg-zinc-800 border border-zinc-700 rounded px-2 py-1 mt-1 text-white"
              >
                {ADD_ITEM_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>

            <div>
              <div className="text-xs text-zinc-500">Price</div>
              <input
                type="number"
                value={form.price}
                onChange={(e) => {
                  setForm({ ...form, price: e.target.value });
                  if (errors.price) setErrors((s) => ({ ...s, price: undefined }));
                }}
                className="w-full bg-zinc-800 border border-zinc-700 rounded px-2 py-1 mt-1 text-white"
              />
              {errors.price && <div className="text-rose-400 text-xs mt-1">{errors.price}</div>}
            </div>

            <div>
              <div className="text-xs text-zinc-500">Condition</div>
              <select
                value={form.condition}
                onChange={(e) => setForm({ ...form, condition: e.target.value as "Excellent" | "Good" | "Fair" | "Poor" })}
                className="w-full bg-zinc-800 border border-zinc-700 rounded px-2 py-1 mt-1 text-white"
              >
                <option>Excellent</option>
                <option>Good</option>
                <option>Fair</option>
                <option>Poor</option>
              </select>
              <div className={`inline-block mt-2 px-2 py-1 rounded text-xs ${conditionColors[form.condition]}`}>{form.condition}</div>
            </div>

            <div>
              <div className="text-xs text-zinc-500">Location</div>
              <input
                type="text"
                value={form.location}
                onChange={(e) => setForm({ ...form, location: e.target.value })}
                className="w-full bg-zinc-800 border border-zinc-700 rounded px-2 py-1 mt-1 text-white"
              />
            </div>

            <div>
              <div className="text-xs text-zinc-500">Repair Location</div>
              <input
                type="text"
                value={form.repairLocation}
                onChange={(e) => setForm({ ...form, repairLocation: e.target.value })}
                className="w-full bg-zinc-800 border border-zinc-700 rounded px-2 py-1 mt-1 text-white"
              />
            </div>

            <div>
              <div className="text-xs text-zinc-500">Brand</div>
              <input
                type="text"
                value={form.brand}
                onChange={(e) => setForm({ ...form, brand: e.target.value })}
                className="w-full bg-zinc-800 border border-zinc-700 rounded px-2 py-1 mt-1 text-white"
              />
            </div>

            <div>
              <div className="text-xs text-zinc-500">Year</div>
              <input
                type="number"
                value={form.year}
                onChange={(e) => {
                  setForm({ ...form, year: Number(e.target.value) });
                  if (errors.year) setErrors((s) => ({ ...s, year: undefined }));
                }}
                className="w-full bg-zinc-800 border border-zinc-700 rounded px-2 py-1 mt-1 text-white"
              />
              {errors.year && <div className="text-rose-400 text-xs mt-1">{errors.year}</div>}
            </div>
          </div>

          <div>
            <div className="text-xs text-zinc-500 mb-2">Dimensions (W × H × D)</div>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="text-xs text-zinc-600">Width</label>
                <input
                  type="number"
                  value={form.width}
                  onChange={(e) => {
                    setForm({ ...form, width: e.target.value });
                    if (errors.width) setErrors((s) => ({ ...s, width: undefined }));
                  }}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-white"
                />
                {errors.width && <div className="text-rose-400 text-xs mt-1">{errors.width}</div>}
              </div>
              <div>
                <label className="text-xs text-zinc-600">Height</label>
                <input
                  type="number"
                  value={form.height}
                  onChange={(e) => {
                    setForm({ ...form, height: e.target.value });
                    if (errors.height) setErrors((s) => ({ ...s, height: undefined }));
                  }}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-white"
                />
                {errors.height && <div className="text-rose-400 text-xs mt-1">{errors.height}</div>}
              </div>
              <div>
                <label className="text-xs text-zinc-600">Depth</label>
                <input
                  type="number"
                  value={form.depth}
                  onChange={(e) => {
                    setForm({ ...form, depth: e.target.value });
                    if (errors.depth) setErrors((s) => ({ ...s, depth: undefined }));
                  }}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-white"
                />
                {errors.depth && <div className="text-rose-400 text-xs mt-1">{errors.depth}</div>}
              </div>
            </div>
          </div>

          <div>
            <div className="text-xs text-zinc-500">Material</div>
            <input
              type="text"
              value={form.material}
              onChange={(e) => setForm({ ...form, material: e.target.value })}
              className="w-full bg-zinc-800 border border-zinc-700 rounded px-2 py-1 mt-1 text-white"
            />
          </div>

          <div>
            <div className="text-xs text-zinc-500">Damage/Condition Notes</div>
            <textarea
              value={form.damageDescription}
              onChange={(e) => setForm({ ...form, damageDescription: e.target.value })}
              className="w-full bg-zinc-800 border border-zinc-700 rounded px-2 py-1 mt-1 text-white min-h-20"
            />
          </div>

          <div>
            <div className="text-xs text-zinc-500">General Notes</div>
            <textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              className="w-full bg-zinc-800 border border-zinc-700 rounded px-2 py-1 mt-1 text-white min-h-20"
            />
          </div>

          <div>
            <div className="text-xs text-zinc-500 mb-2">Purchase Status (Click to toggle)</div>
            
            {/* Stock Indicator in Status Section */}
            <div className="mb-3 flex items-center gap-2 px-3 py-2 rounded-lg border border-zinc-700 bg-zinc-800/50 w-fit">
              <div
                className={`w-2.5 h-2.5 rounded-full ${
                  (form.stockCount ?? 0) <= (form.stockLimit ?? 10) / 2
                    ? "bg-red-500 stock-indicator-critical"
                    : (form.stockCount ?? 0) < (form.stockLimit ?? 10)
                    ? "bg-yellow-500 stock-indicator-low"
                    : "bg-green-500"
                }`}
              />
              <div className="text-xs font-medium">
                <span className="text-zinc-300">Stock:</span> <span className="text-white font-semibold">{form.stockCount ?? 0}</span>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {(form.repairs ?? []).map((r, i) => {
                const isRepairStep = r.name === "Repair";
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => {
                      const updated = [...(form.repairs ?? [])];
                      const clicked = updated[i];
                      let newDone = clicked.done;
                      let newState = (clicked as RepairStep).state || "none";
                      let triggerCheckCascade = false;
                      let triggerUncheckCascade = false;

                      if (isRepairStep) {
                        const cycle = (s: string) =>
                          s === "none"
                            ? "noNeed"
                            : s === "noNeed"
                            ? "inProgress"
                            : s === "inProgress"
                            ? "repaired"
                            : "none";
                        newState = cycle(newState);
                        newDone = newState !== "none";
                        if (newDone && !clicked.done) triggerCheckCascade = true;
                        if (!newDone && clicked.done) triggerUncheckCascade = true;
                      } else {
                        if (!clicked.done) {
                          newDone = true;
                          triggerCheckCascade = true;
                        } else {
                          newDone = false;
                          triggerUncheckCascade = true;
                        }
                      }

                      updated[i] = { ...updated[i], done: newDone } as RepairStep;
                      if (isRepairStep) (updated[i] as RepairStep).state = newState;

                      if (triggerCheckCascade) {
                        for (let j = 0; j < i; j++) {
                          updated[j] = { ...updated[j], done: true } as RepairStep;
                          if (updated[j].name === "Repair") (updated[j] as RepairStep).state = "noNeed";
                        }
                      }

                      if (triggerUncheckCascade) {
                        for (let j = i + 1; j < updated.length; j++) {
                          updated[j] = { ...updated[j], done: false } as RepairStep;
                          if (updated[j].name === "Repair") (updated[j] as RepairStep).state = "none";
                        }
                      }

                      setForm((prev) => ({ ...prev, repairs: updated }));
                    }}
                    className={`px-3 py-1 rounded-full text-xs font-semibold transition-all ${
                      r.done ? "bg-green-900 hover:bg-green-800" : "bg-orange-900 hover:bg-orange-800"
                    } ${
                      isRepairStep
                        ? (r as RepairStep).state === "noNeed"
                          ? "text-green-200"
                          : (r as RepairStep).state === "inProgress" || (r as RepairStep).state === "repaired"
                          ? "text-orange-400"
                          : "text-orange-200"
                        : r.done
                        ? "text-green-200"
                        : "text-orange-200"
                    } hover:opacity-80 cursor-pointer focus:outline-none`}
                  >
                    {r.name}: {r.done ? (isRepairStep && (r as RepairStep).state === "inProgress" ? "..." : "✓") : "○"}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="flex gap-2 p-6 border-t border-zinc-700">
          <button onClick={onCancel} className="flex-1 bg-zinc-700 hover:bg-zinc-600 text-white px-4 py-2 rounded-lg transition-colors">
            Cancel
          </button>
          <button
            onClick={() => {
              const nextErrors: { name?: string; price?: string; width?: string; height?: string; depth?: string; year?: string } = {};

              const validateNonNegativeNumeric = (value: string | number, fieldName: string) => {
                if (value === "" || value === null || value === undefined) return null;
                const parsed = typeof value === "number" ? value : Number(String(value).replace(",", "."));
                if (!Number.isFinite(parsed)) return `${fieldName} must be a valid number`;
                if (parsed < 0) return `${fieldName} cannot be negative`;
                return null;
              };

              const priceError = validateNonNegativeNumeric(form.price, "Price");
              if (priceError) nextErrors.price = priceError;
              const widthError = validateNonNegativeNumeric(form.width, "Width");
              if (widthError) nextErrors.width = widthError;
              const heightError = validateNonNegativeNumeric(form.height, "Height");
              if (heightError) nextErrors.height = heightError;
              const depthError = validateNonNegativeNumeric(form.depth, "Depth");
              if (depthError) nextErrors.depth = depthError;

              const currentYear = new Date().getFullYear() + 1;
              if (!Number.isFinite(form.year) || form.year < 1900 || form.year > currentYear) {
                nextErrors.year = `Year must be between 1900 and ${currentYear}`;
              }

              if (!form.name.trim()) nextErrors.name = "Name is required";

              if (Object.keys(nextErrors).length > 0) {
                setErrors(nextErrors);
                return;
              }

              onCreate({ ...form, name: form.name.trim() });
            }}
            disabled={!form.name.trim()}
            className={`flex-1 px-4 py-2 rounded-lg transition-colors font-semibold ${
              !form.name.trim() ? "bg-zinc-700 text-zinc-400 cursor-not-allowed" : "bg-green-600 hover:bg-green-700 text-white"
            }`}
          >
            Save Changes
          </button>
        </div>

        {showCameraModal && (
          <SimpleCameraModal
            title="Add photos"
            onClose={() => setShowCameraModal(false)}
            onCapture={(photoDataUrl) => {
              setForm((prev) => ({ ...prev, photos: [...(prev.photos ?? []), photoDataUrl] }));
            }}
          />
        )}
      </div>
    </div>
  );
}

/* ---------------- KPI MODAL ---------------- */

function KpiModal({
  totalValue,
  categoryStats,
  onClose,
}: {
  totalValue: number;
  categoryStats: [string, number][];
  onClose: () => void;
}) {
  const max = Math.max(...categoryStats.map(([, v]) => v), 1);

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
      <div className="bg-zinc-900 p-8 rounded-2xl min-w-[350px] relative">
        <button onClick={onClose} className="absolute top-2 right-2 text-2xl">✕</button>
        <div className="mb-6">
          <div className="text-zinc-400">Total Stock Value</div>
          <div className="text-3xl">{formatEuro(totalValue)}</div>
        </div>
        <div>
          <div className="text-zinc-400 mb-2">Items per Category</div>
          {categoryStats.map(([cat, val]) => (
            <div key={cat} className="mb-2">
              <div className="flex justify-between text-sm">
                <span>{cat}</span>
                <span>{val}</span>
              </div>
              <div className="bg-zinc-800 h-3 rounded">
                <div
                  className="bg-orange-500 h-3 rounded"
                  style={{ width: `${(val / max) * 100}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function AnalyticsModal({
  totalItems,
  soldItems,
  totalValue,
  categoryStats,
  onClose,
}: {
  totalItems: number;
  soldItems: number;
  totalValue: number;
  categoryStats: [string, number][];
  onClose: () => void;
}) {
  const activeItems = totalItems - soldItems;
  const avgPrice = totalItems > 0 ? totalValue / totalItems : 0;
  const max = Math.max(...categoryStats.map(([, value]) => value), 1);

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[70] p-4" onClick={onClose}>
      <div className="bg-zinc-900 p-6 rounded-2xl w-full max-w-4xl max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-2xl font-bold text-orange-500">Kim&apos;s Chocolate Analytics</h2>
          <button onClick={onClose} className="text-2xl text-zinc-400 hover:text-orange-500" aria-label="Close analytics">✕</button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
          <div className="rounded-xl border border-zinc-700 bg-zinc-800/60 p-3">
            <div className="text-xs text-zinc-400">Total Items</div>
            <div className="text-2xl font-semibold">{totalItems}</div>
          </div>
          <div className="rounded-xl border border-zinc-700 bg-zinc-800/60 p-3">
            <div className="text-xs text-zinc-400">Active</div>
            <div className="text-2xl font-semibold text-emerald-400">{activeItems}</div>
          </div>
          <div className="rounded-xl border border-zinc-700 bg-zinc-800/60 p-3">
            <div className="text-xs text-zinc-400">Sold</div>
            <div className="text-2xl font-semibold text-rose-400">{soldItems}</div>
          </div>
          <div className="rounded-xl border border-zinc-700 bg-zinc-800/60 p-3">
            <div className="text-xs text-zinc-400">Average Price</div>
            <div className="text-2xl font-semibold">{formatEuro(avgPrice)}</div>
          </div>
        </div>

        <div className="rounded-xl border border-zinc-700 bg-zinc-800/40 p-4">
          <div className="text-sm text-zinc-300 mb-3">Items by Category</div>
          {categoryStats.length === 0 ? (
            <div className="text-sm text-zinc-500">No data</div>
          ) : (
            categoryStats.map(([category, count]) => (
              <div key={category} className="mb-2">
                <div className="flex justify-between text-sm">
                  <span>{category}</span>
                  <span>{count}</span>
                </div>
                <div className="bg-zinc-700 h-3 rounded">
                  <div className="bg-orange-500 h-3 rounded" style={{ width: `${(count / max) * 100}%` }} />
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

/* ---------------- ITEM DETAILS MODAL ---------------- */

function ItemDetailsModal({
  item,
  editMode,
  onClose,
  onEdit,
  onCancelEdit,
  onSave,
  onDelete,
  onToggleSold,
  onAddPhoto,
  onOpenPhoto,
  onAddLog,
  onRemoveLog,
}: {
  item: Item;
  editMode: boolean;
  onClose: () => void;
  onEdit: () => void;
  onCancelEdit: () => void;
  onSave: (item: Item) => void;
  onDelete: () => void;
  onToggleSold: (nextSold: boolean) => void;
  onAddPhoto: (photoDataUrl: string) => void;
  onOpenPhoto: (photoIdx: number) => void;
  onAddLog?: (key: string, msg: string) => void;
  onRemoveLog?: (key: string) => void;
}) {
  const [editData, setEditData] = useState<Item>(item);
  const [showCameraModal, setShowCameraModal] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

  const handleSave = () => {
    onSave(editData);
    onClose();
  };

  const conditionColors = {
    Excellent: "text-green-400 bg-green-900/20",
    Good: "text-blue-400 bg-blue-900/20",
    Fair: "text-yellow-400 bg-yellow-900/20",
    Poor: "text-red-400 bg-red-900/20",
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 overflow-y-auto" onClick={onClose}>
      <div className="bg-zinc-900 rounded-2xl max-w-2xl w-full mx-4 my-6 relative" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex justify-between items-start p-6 border-b border-zinc-700">
          <div>
            <div className="text-xs text-zinc-500">{item.code}</div>
            <h2 className="text-2xl font-bold text-orange-500">{item.name}</h2>
          </div>
          <button onClick={onClose} className="text-2xl hover:text-orange-500" aria-label="Close">✕</button>
        </div>

        {/* Content */}
        <div className="p-6 max-h-[70vh] overflow-y-auto space-y-6">
          {/* Photos Section */}
          <div>
            <div className="text-sm text-zinc-400 mb-2">Photos ({(editMode ? editData.photos : item.photos).length})</div>
            {editMode ? (
              <div className="rounded-xl border border-zinc-700 bg-zinc-800/30 p-3">
                <EditablePhotoStrip
                  photos={editData.photos}
                  onRemove={(idx) => {
                    setEditData((prev) => ({
                      ...prev,
                      photos: prev.photos.filter((_, i) => i !== idx),
                    }));
                  }}
                  onAdd={() => setShowCameraModal(true)}
                />
              </div>
            ) : (
              <div className="flex gap-2 overflow-x-auto pb-1">
                {item.photos.map((photo, idx) => (
                  <button
                    key={`${item.id}-view-photo-${idx}`}
                    type="button"
                    onClick={() => onOpenPhoto(idx)}
                    className="shrink-0 rounded border border-zinc-700 hover:border-orange-500 transition-colors"
                    title={`Open photo ${idx + 1}`}
                    aria-label={`Open photo ${idx + 1}`}
                  >
                    <Image
                      src={photo}
                      width={96}
                      height={96}
                      unoptimized
                      alt={`Item photo ${idx + 1}`}
                      className="w-24 h-24 object-cover rounded"
                    />
                  </button>
                ))}

                <button
                  type="button"
                  onClick={() => setShowCameraModal(true)}
                  className="w-24 h-24 shrink-0 rounded border border-dashed border-zinc-500 hover:border-orange-400 text-zinc-300 hover:text-orange-300 text-xs p-2"
                  title="Add photos"
                  aria-label="Add photos"
                >
                  Add photos
                </button>
              </div>
            )}
          </div>

          {/* Stock Section */}
          <div className="mb-6">
            <div className="text-sm text-zinc-400 mb-4 font-semibold">Inventory Management</div>
            
            {/* Stock Graph */}
            <div className="bg-zinc-800/50 rounded-lg p-4 mb-4">
              <div className="text-xs text-zinc-500 mb-2">Stock History (Last 15 days)</div>
              {(editData.stockHistory || []).length > 0 && (
                <svg viewBox="0 0 600 280" className="w-full border border-zinc-700 rounded bg-zinc-900/30">
                  {/* Y-Axis */}
                  <line x1="50" y1="20" x2="50" y2="240" stroke="rgb(113 113 122)" strokeWidth="1" />
                  {/* X-Axis */}
                  <line x1="50" y1="240" x2="580" y2="240" stroke="rgb(113 113 122)" strokeWidth="1" />
                  
                  {/* Y-Axis Labels and Grid Lines */}
                  {(() => {
                    const maxCount = Math.max(
                      ...(editData.stockHistory || []).map((h) => h.count),
                      editData.stockLimit * 1.5
                    );
                    const yStep = Math.ceil(maxCount / 5 / 10) * 10;
                    const labels = [];
                    for (let i = 0; i <= maxCount; i += yStep) {
                      labels.push(i);
                    }
                    return labels.map((label) => {
                      const y = 240 - (label / maxCount) * 220;
                      return (
                        <g key={`y-${label}`}>
                          {/* Grid line */}
                          <line x1="50" y1={y} x2="580" y2={y} stroke="rgb(39 39 42)" strokeWidth="0.5" strokeDasharray="2,2" />
                          {/* Y-Axis label */}
                          <text x="40" y={y + 4} fontSize="11" fill="rgb(161 161 170)" textAnchor="end">
                            {label}
                          </text>
                        </g>
                      );
                    });
                  })()}
                  
                  {/* Stock Limit Line (vertical orange line) */}
                  {(() => {
                    const maxCount = Math.max(
                      ...(editData.stockHistory || []).map((h) => h.count),
                      editData.stockLimit * 1.5
                    );
                    const limitY = 240 - (editData.stockLimit / maxCount) * 220;
                    return (
                      <line
                        x1="50"
                        y1={limitY}
                        x2="580"
                        y2={limitY}
                        stroke="rgb(249 115 22)"
                        strokeWidth="2"
                        strokeDasharray="5,5"
                      />
                    );
                  })()}
                  
                  {/* Stock History Line and Points */}
                  {(() => {
                    const history = editData.stockHistory || [];
                    if (history.length === 0) return null;
                    
                    const maxCount = Math.max(
                      ...history.map((h) => h.count),
                      editData.stockLimit * 1.5
                    );
                    
                    const points = history.map((entry, idx) => {
                      const x = 50 + ((idx + 1) / history.length) * 530;
                      const y = 240 - (entry.count / maxCount) * 220;
                      return { x, y, entry, idx };
                    });
                    
                    return (
                      <g>
                        {/* Line connecting points */}
                        <polyline
                          points={points.map((p) => `${p.x},${p.y}`).join(" ")}
                          fill="none"
                          stroke="rgb(34 197 94)"
                          strokeWidth="2"
                          strokeLinejoin="round"
                          strokeLinecap="round"
                        />
                        
                        {/* Points on line */}
                        {points.map((p) => (
                          <g key={`point-${p.idx}`}>
                            <circle
                              cx={p.x}
                              cy={p.y}
                              r="4"
                              fill="rgb(34 197 94)"
                              stroke="rgb(24 24 27)"
                              strokeWidth="1"
                            />
                            {/* Tooltip on hover */}
                            <title>{`${p.entry.date}: ${p.entry.count} ${editData.stockUnit}`}</title>
                          </g>
                        ))}
                      </g>
                    );
                  })()}
                  
                  {/* X-Axis Labels (show every 2-3 days) */}
                  {(() => {
                    const history = editData.stockHistory || [];
                    return history.map((entry, idx) => {
                      if (idx % 2 === 0 || idx === history.length - 1) {
                        const x = 50 + ((idx + 1) / history.length) * 530;
                        const dateObj = new Date(entry.date);
                        const label = `${dateObj.getMonth() + 1}/${dateObj.getDate()}`;
                        return (
                          <text
                            key={`x-${idx}`}
                            x={x}
                            y="260"
                            fontSize="11"
                            fill="rgb(161 161 170)"
                            textAnchor="middle"
                          >
                            {label}
                          </text>
                        );
                      }
                      return null;
                    });
                  })()}
                  
                  {/* Axis Labels */}
                  <text x="20" y="130" fontSize="12" fill="rgb(161 161 170)" textAnchor="middle" transform="rotate(-90 20 130)">
                    Stock Count
                  </text>
                  <text x="315" y="275" fontSize="12" fill="rgb(161 161 170)" textAnchor="middle">
                    Date
                  </text>
                </svg>
              )}
              
              {/* Legend */}
              <div className="mt-3 flex gap-4 text-xs">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-green-500" />
                  <span className="text-zinc-400">Stock Level</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-0.5 bg-orange-500" style={{backgroundImage: 'repeating-linear-gradient(90deg, rgb(249 115 22) 0px, rgb(249 115 22) 5px, transparent 5px, transparent 10px)'}} />
                  <span className="text-zinc-400">Low Stock Limit: {editData.stockLimit} {editData.stockUnit}</span>
                </div>
              </div>
            </div>

            {/* Stock Current Status */}
            <div className="grid grid-cols-3 gap-3 mb-4">
              <div className="bg-zinc-800/30 p-3 rounded">
                <div className="text-xs text-zinc-500">Current Stock</div>
                {editMode ? (
                  <input
                    type="number"
                    value={editData.stockCount}
                    onChange={(e) => {
                      const newCount = parseInt(e.target.value) || 0;
                      const newHistory = [...editData.stockHistory];
                      const today = new Date().toISOString().split("T")[0];
                      const todayEntry = newHistory.find((h) => h.date === today);
                      if (todayEntry) {
                        todayEntry.count = newCount;
                      } else {
                        newHistory.push({ date: today, count: newCount });
                        newHistory.sort((a, b) => a.date.localeCompare(b.date));
                        newHistory.slice(-15);
                      }
                      setEditData({ ...editData, stockCount: newCount, stockHistory: newHistory });
                    }}
                    className="w-full bg-zinc-700 border border-zinc-600 rounded px-2 py-1 mt-1 text-white text-lg font-bold"
                  />
                ) : (
                  <div className={`text-lg font-bold mt-1 ${editData.stockCount < editData.stockLimit ? "text-red-400" : "text-green-400"}`}>
                    {editData.stockCount}
                  </div>
                )}
              </div>
              
              <div className="bg-zinc-800/30 p-3 rounded">
                <div className="text-xs text-zinc-500">Low Stock Limit</div>
                {editMode ? (
                  <input
                    type="number"
                    value={editData.stockLimit}
                    onChange={(e) => setEditData({ ...editData, stockLimit: parseInt(e.target.value) || 0 })}
                    className="w-full bg-zinc-700 border border-zinc-600 rounded px-2 py-1 mt-1 text-white text-lg font-bold"
                  />
                ) : (
                  <div className="text-lg font-bold mt-1 text-orange-400">{editData.stockLimit}</div>
                )}
              </div>
              
              <div className="bg-zinc-800/30 p-3 rounded">
                <div className="text-xs text-zinc-500">Unit</div>
                {editMode ? (
                  <input
                    type="text"
                    value={editData.stockUnit}
                    onChange={(e) => setEditData({ ...editData, stockUnit: e.target.value })}
                    className="w-full bg-zinc-700 border border-zinc-600 rounded px-2 py-1 mt-1 text-white text-sm"
                    placeholder="e.g. units, boxes, pallets"
                  />
                ) : (
                  <div className="text-sm font-semibold mt-1 text-zinc-300">{editData.stockUnit}</div>
                )}
              </div>
            </div>

            {editData.stockCount < editData.stockLimit && (
              <div className="bg-red-900/20 border border-red-700 rounded px-3 py-2 mb-4">
                <div className="text-xs text-red-300 font-semibold">⚠️ Low Stock Alert</div>
                <div className="text-xs text-red-200">Consider ordering more. Current: {editData.stockCount}, Limit: {editData.stockLimit}</div>
              </div>
            )}
          </div>

          {/* Main Details Grid */}
          <div className="grid grid-cols-2 gap-4">
            {/* Category */}
            <div>
              <div className="text-xs text-zinc-500">Category</div>
              {editMode ? (
                <input
                  type="text"
                  value={editData.category}
                  onChange={(e) => setEditData({ ...editData, category: e.target.value })}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded px-2 py-1 mt-1 text-white"
                />
              ) : (
                <div className="text-orange-400 font-semibold">{item.category}</div>
              )}
            </div>

            {/* Price */}
            <div>
              <div className="text-xs text-zinc-500">Price</div>
              {editMode ? (
                <input
                  type="number"
                  value={editData.price}
                  onChange={(e) => setEditData({ ...editData, price: parseFloat(e.target.value) })}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded px-2 py-1 mt-1 text-white"
                />
              ) : (
                <div className="text-green-400 font-semibold">{formatEuro(item.price)}</div>
              )}
            </div>

            {/* Condition */}
            <div>
              <div className="text-xs text-zinc-500">Condition</div>
              {editMode ? (
                <select
                  value={editData.condition}
                  onChange={(e) => setEditData({ ...editData, condition: e.target.value as "Excellent" | "Good" | "Fair" | "Poor" })}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded px-2 py-1 mt-1 text-white"
                >
                  <option>Excellent</option>
                  <option>Good</option>
                  <option>Fair</option>
                  <option>Poor</option>
                </select>
              ) : (
                <div className={`font-semibold px-2 py-1 rounded inline-block ${conditionColors[item.condition]}`}>
                  {item.condition}
                </div>
              )}
            </div>

            {/* Location */}
            <div>
              <div className="text-xs text-zinc-500">Location</div>
              {editMode ? (
                <input
                  type="text"
                  value={editData.location}
                  onChange={(e) => setEditData({ ...editData, location: e.target.value })}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded px-2 py-1 mt-1 text-white"
                />
              ) : (
                <div className="text-white">{item.location}</div>
              )}
            </div>

            {/* Repair Location */}
            <div>
              <div className="text-xs text-zinc-500">Repair Location</div>
              {editMode ? (
                <input
                  type="text"
                  value={editData.repairLocation}
                  onChange={(e) => setEditData({ ...editData, repairLocation: e.target.value })}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded px-2 py-1 mt-1 text-white"
                />
              ) : (
                <div className="text-white">{item.repairLocation}</div>
              )}
            </div>

            {/* Brand */}
            <div>
              <div className="text-xs text-zinc-500">Brand</div>
              {editMode ? (
                <input
                  type="text"
                  value={editData.brand}
                  onChange={(e) => setEditData({ ...editData, brand: e.target.value })}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded px-2 py-1 mt-1 text-white"
                />
              ) : (
                <div className="text-white">{item.brand}</div>
              )}
            </div>

            {/* Year */}
            <div>
              <div className="text-xs text-zinc-500">Year</div>
              {editMode ? (
                <input
                  type="number"
                  value={editData.year}
                  onChange={(e) => setEditData({ ...editData, year: parseInt(e.target.value) })}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded px-2 py-1 mt-1 text-white"
                />
              ) : (
                <div className="text-white">{item.year}</div>
              )}
            </div>
          </div>

          {/* Dimensions */}
          <div>
            <div className="text-xs text-zinc-500 mb-2">Dimensions (W × H × D)</div>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="text-xs text-zinc-600">Width</label>
                {editMode ? (
                  <input
                    type="number"
                    value={editData.width}
                    onChange={(e) => setEditData({ ...editData, width: parseFloat(e.target.value) })}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-white"
                  />
                ) : (
                  <div className="text-white">{item.width} cm</div>
                )}
              </div>
              <div>
                <label className="text-xs text-zinc-600">Height</label>
                {editMode ? (
                  <input
                    type="number"
                    value={editData.height}
                    onChange={(e) => setEditData({ ...editData, height: parseFloat(e.target.value) })}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-white"
                  />
                ) : (
                  <div className="text-white">{item.height} cm</div>
                )}
              </div>
              <div>
                <label className="text-xs text-zinc-600">Depth</label>
                {editMode ? (
                  <input
                    type="number"
                    value={editData.depth}
                    onChange={(e) => setEditData({ ...editData, depth: parseFloat(e.target.value) })}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-white"
                  />
                ) : (
                  <div className="text-white">{item.depth} cm</div>
                )}
              </div>
            </div>
          </div>

          {/* Material */}
          <div>
            <div className="text-xs text-zinc-500">Material</div>
            {editMode ? (
              <input
                type="text"
                value={editData.material}
                onChange={(e) => setEditData({ ...editData, material: e.target.value })}
                className="w-full bg-zinc-800 border border-zinc-700 rounded px-2 py-1 mt-1 text-white"
              />
            ) : (
              <div className="text-white">{item.material}</div>
            )}
          </div>

          {/* Damage Description */}
          <div>
            <div className="text-xs text-zinc-500">Damage/Condition Notes</div>
            {editMode ? (
              <textarea
                value={editData.damageDescription}
                onChange={(e) => setEditData({ ...editData, damageDescription: e.target.value })}
                className="w-full bg-zinc-800 border border-zinc-700 rounded px-2 py-1 mt-1 text-white min-h-20"
              />
            ) : (
              <div className="text-zinc-300">{item.damageDescription || "None reported"}</div>
            )}
          </div>

          {/* General Notes */}
          <div>
            <div className="text-xs text-zinc-500">General Notes</div>
            {editMode ? (
              <textarea
                value={editData.notes}
                onChange={(e) => setEditData({ ...editData, notes: e.target.value })}
                className="w-full bg-zinc-800 border border-zinc-700 rounded px-2 py-1 mt-1 text-white min-h-20"
              />
            ) : (
              <div className="text-zinc-300">{item.notes}</div>
            )}
          </div>

          {/* Repair Status */}
          <div>
            <div className="text-xs text-zinc-500 mb-2">Purchase Status {editMode && "(Click to toggle)"}</div>
            
            {/* Stock Indicator in Status Section */}
            <div className="mb-3 flex items-center gap-2 px-3 py-2 rounded-lg border border-zinc-700 bg-zinc-800/50 w-fit">
              <div
                className={`w-2.5 h-2.5 rounded-full ${
                  editData.stockCount <= editData.stockLimit / 2
                    ? "bg-red-500 stock-indicator-critical"
                    : editData.stockCount < editData.stockLimit
                    ? "bg-yellow-500 stock-indicator-low"
                    : "bg-green-500"
                }`}
              />
              <div className="text-xs font-medium">
                <span className="text-zinc-300">Stock:</span> <span className="text-white font-semibold">{editData.stockCount}</span>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {editData.repairs.map((r, i) => {
                const isRepairStep = r.name === "Repair";

                return (
                  <button
                    key={i}
                    onClick={() => {
                      if (!editMode) return;
                      const updated = [...editData.repairs];
                      const clicked = updated[i];
                      const isRepair = clicked.name === "Repair";

                      let newDone = clicked.done;
                      let newState = (clicked as RepairStep).state || "none";
                      let triggerCheckCascade = false;
                      let triggerUncheckCascade = false;
                      const prevState = (clicked as RepairStep).state || "none";
                      let addedLog: string | null = null;
                      let removedKey: string | null = null;

                      if (isRepair) {
                        const cycle = (s: string) =>
                          s === "none"
                            ? "noNeed"
                            : s === "noNeed"
                            ? "inProgress"
                            : s === "inProgress"
                            ? "repaired"
                            : "none";
                        newState = cycle(newState);
                        newDone = newState !== "none";

                        if (prevState !== "repaired" && newState === "repaired") {
                          addedLog = `${editData.name} is repaired in ${editData.repairLocation || editData.location}`;
                        } else if (prevState === "repaired" && newState !== "repaired") {
                          removedKey = `repair:${item.id}`;
                        }

                        // simple cascade like other steps
                        if (newDone && !clicked.done) triggerCheckCascade = true;
                        if (!newDone && clicked.done) triggerUncheckCascade = true;
                      } else {
                        if (!clicked.done) {
                          newDone = true;
                          triggerCheckCascade = true;
                        } else {
                          newDone = false;
                          triggerUncheckCascade = true;
                        }
                      }

                      updated[i] = { ...updated[i], done: newDone } as RepairStep;
                      if (isRepair) (updated[i] as RepairStep).state = newState;

                      // apply any log updates via provided callbacks
                      if (addedLog && onAddLog) onAddLog(`repair:${item.id}`, addedLog);
                      if (removedKey && onRemoveLog) onRemoveLog(removedKey);

                      if (triggerCheckCascade) {
                        for (let j = 0; j < i; j++) {
                          updated[j] = {
                            ...updated[j],
                            done: true,
                          } as RepairStep;
                          if (updated[j].name === "Repair") (updated[j] as RepairStep).state = "noNeed";
                        }
                      }

                      if (triggerUncheckCascade) {
                        for (let j = i + 1; j < updated.length; j++) {
                          updated[j] = {
                            ...updated[j],
                            done: false,
                          } as RepairStep;
                          if (updated[j].name === "Repair") (updated[j] as RepairStep).state = "none";
                        }
                      }

                      setEditData({ ...editData, repairs: updated });
                    }}
                    disabled={!editMode}
                    className={`px-3 py-1 rounded-full text-xs font-semibold transition-all ${
                      r.done ? "bg-green-900 hover:bg-green-800" : "bg-orange-900 hover:bg-orange-800"
                    } ${
                      isRepairStep
                        ? (r as RepairStep).state === "noNeed"
                          ? "text-green-200"
                          : (r as RepairStep).state === "inProgress" || (r as RepairStep).state === "repaired"
                          ? "text-orange-400"
                          : "text-orange-200"
                        : r.done
                        ? "text-green-200"
                        : "text-orange-200"
                    } ${
                      editMode ? "hover:opacity-80 cursor-pointer focus:outline-none" : "cursor-default opacity-75"
                    }`}
                    title={editMode ? (isRepairStep ? "Click to cycle Repair state" : "Click to toggle repair step") : ""}
                  >
                    {r.name}: {r.done ? (isRepairStep && (r as RepairStep).state === "inProgress" ? "…" : "✓") : "○"}
                  </button>
                );
              })}
              <button
                type="button"
                onClick={() => onToggleSold(!item.sold)}
                className={`px-3 py-1 rounded-full text-xs font-semibold transition-all hover:opacity-80 ${
                  item.sold ? "bg-zinc-700 text-zinc-300" : "bg-zinc-800 text-zinc-400"
                }`}
                title="Toggle sold status"
              >
                Sold: {item.sold ? "✓" : "○"}
              </button>
            </div>
          </div>

          {item.sold && (
            <div className="rounded-xl border border-zinc-700 bg-zinc-800/40 p-3">
              <div className="text-xs text-zinc-500">Sale Details</div>
              <div className="mt-1 text-sm text-zinc-200">Sold by: {item.soldBy || "unknown"}</div>
              <div className="text-sm text-zinc-200">
                Sold at: {item.soldAt ? new Date(item.soldAt).toLocaleString() : "unknown"}
              </div>
            </div>
          )}

          {/* Metadata */}
          <div className="grid grid-cols-2 gap-4 text-xs text-zinc-500">
            <div>Date Added: {item.dateAdded}</div>
            <div>Item Code: {item.code}</div>
            <div>Created By: {item.createdBy || "unknown"}</div>
            <div>Last Updated By: {item.updatedBy || "unknown"}</div>
            <div>Revision: {item.revision || 1}</div>
            <div>Audit Entries: {Array.isArray(item.auditTrail) ? item.auditTrail.length : 0}</div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-2 p-6 border-t border-zinc-700">
          {editMode ? (
            <>
              <button
                onClick={() => {
                  setEditData(item);
                  onCancelEdit();
                }}
                className="flex-1 bg-zinc-700 hover:bg-zinc-600 text-white px-4 py-2 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                className="flex-1 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg transition-colors font-semibold"
              >
                Save Changes
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => {
                  setEditData(item);
                  onEdit();
                }}
                className="flex-1 bg-orange-500 hover:bg-orange-600 text-black px-4 py-2 rounded-lg transition-colors font-semibold"
              >
                Edit
              </button>
              <button
                onClick={() => setConfirmDeleteOpen(true)}
                className="flex-1 bg-rose-700 hover:bg-rose-800 text-white px-4 py-2 rounded-lg transition-colors font-semibold"
              >
                Delete Item
              </button>
              {item.sold && (
                <button
                  onClick={() => onToggleSold(false)}
                  className="flex-1 bg-amber-700 hover:bg-amber-800 text-white px-4 py-2 rounded-lg transition-colors font-semibold"
                >
                  Cancel Purchase
                </button>
              )}
              <button
                onClick={onClose}
                className="flex-1 bg-zinc-700 hover:bg-zinc-600 text-white px-4 py-2 rounded-lg transition-colors"
                aria-label="Close"
              >
                ✕
              </button>
            </>
          )}
        </div>
      </div>

      {showCameraModal && (
        <SimpleCameraModal
          title={`Add photos to ${editData.name}`}
          onClose={() => setShowCameraModal(false)}
          onCapture={(photoDataUrl) => {
            if (editMode) {
              setEditData((prev) => ({ ...prev, photos: [...prev.photos, photoDataUrl] }));
              return;
            }
            onAddPhoto(photoDataUrl);
          }}
        />
      )}

      {confirmDeleteOpen && (
        <div className="fixed inset-0 z-[95] bg-black/80 flex items-center justify-center p-4" onClick={() => setConfirmDeleteOpen(false)}>
          <div className="w-full max-w-sm rounded-xl border border-zinc-700 bg-zinc-900 p-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-base font-semibold text-rose-300 mb-2">Delete Item?</h3>
            <p className="text-sm text-zinc-300 mb-4">
              Are you sure you want to delete <span className="text-white font-semibold">{item.name}</span>? This cannot be undone.
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setConfirmDeleteOpen(false)}
                className="flex-1 rounded-lg bg-zinc-700 hover:bg-zinc-600 text-white py-2"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  setConfirmDeleteOpen(false);
                  onDelete();
                }}
                className="flex-1 rounded-lg bg-rose-700 hover:bg-rose-800 text-white font-semibold py-2"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* --------------- SETTINGS SIDEBAR --------------- */

function SettingsSidebar({
  open,
  draft,
  onDraftChange,
  onSaveCompany,
  onCancelCompany,
  onSaveInvoice,
  onCancelInvoice,
  onSavePreferences,
  onCancelPreferences,
  debugInfo,
  onRunSyncNow,
  onCopyLastRequestId,
  onCopyTechnicalSnapshot,
  onResetSyncErrors,
  onClose,
}: {
  open: boolean;
  draft: AppSettings;
  onDraftChange: (key: keyof AppSettings, value: string | boolean) => void;
  onSaveCompany: () => void;
  onCancelCompany: () => void;
  onSaveInvoice: () => void;
  onCancelInvoice: () => void;
  onSavePreferences: () => void;
  onCancelPreferences: () => void;
  debugInfo: {
    activeUser: string;
    isOnline: boolean;
    itemCount: number;
    queuedOperations: number;
    lastSyncedAt: number | null;
    syncHealth: {
      lastLatencyMs: number | null;
      lastStatus: "idle" | "ok" | "error";
      errorCount: number;
      lastErrorAt: number | null;
      lastRequestId: string | null;
    };
  };
  onRunSyncNow: () => void;
  onCopyLastRequestId: () => void;
  onCopyTechnicalSnapshot: () => void;
  onResetSyncErrors: () => void;
  onClose: () => void;
}) {
  return (
    <div className={`fixed inset-0 z-50 flex ${open ? "" : "pointer-events-none"}`}>
      <div
        className={`bg-black/50 cursor-pointer transition-opacity duration-300 ${open ? "opacity-100 flex-1" : "opacity-0 w-0"}`}
        onClick={onClose}
      />
      <div className={`w-96 bg-zinc-900 border-r border-zinc-700 shadow-lg max-h-screen overflow-y-auto transform transition-transform duration-300 ${open ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="sticky top-0 z-10 bg-zinc-800 border-b border-zinc-700 p-4 flex justify-between items-center">
          <h2 className="text-xl font-bold text-orange-400">Settings</h2>
          <button onClick={onClose} className="text-zinc-400 hover:text-orange-400 text-2xl">✕</button>
        </div>

        <div className="p-4 space-y-6">
          <div className="border-b border-zinc-700 pb-4">
            <h3 className="text-lg font-semibold text-orange-400 mb-3">Company Information</h3>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-zinc-400">Company Name</label>
                <input
                  type="text"
                  value={draft.companyName}
                  onChange={(e) => onDraftChange("companyName", e.target.value)}
                  className="w-full mt-1 bg-zinc-800 border border-zinc-700 rounded p-2 text-white"
                />
              </div>
              <div>
                <label className="text-xs text-zinc-400">Email</label>
                <input
                  type="email"
                  value={draft.companyEmail}
                  onChange={(e) => onDraftChange("companyEmail", e.target.value)}
                  className="w-full mt-1 bg-zinc-800 border border-zinc-700 rounded p-2 text-white"
                />
              </div>
              <div>
                <label className="text-xs text-zinc-400">Phone</label>
                <input
                  type="tel"
                  value={draft.companyPhone}
                  onChange={(e) => onDraftChange("companyPhone", e.target.value)}
                  className="w-full mt-1 bg-zinc-800 border border-zinc-700 rounded p-2 text-white"
                />
              </div>
              <div>
                <label className="text-xs text-zinc-400">Address</label>
                <input
                  type="text"
                  value={draft.companyAddress}
                  onChange={(e) => onDraftChange("companyAddress", e.target.value)}
                  className="w-full mt-1 bg-zinc-800 border border-zinc-700 rounded p-2 text-white"
                />
              </div>
              <div>
                <label className="text-xs text-zinc-400">VAT Number</label>
                <input
                  type="text"
                  value={draft.companyVAT}
                  onChange={(e) => onDraftChange("companyVAT", e.target.value)}
                  className="w-full mt-1 bg-zinc-800 border border-zinc-700 rounded p-2 text-white"
                />
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={onSaveCompany} className="flex-1 bg-orange-500 hover:bg-orange-600 text-black px-3 py-2 rounded font-semibold text-sm">Save Changes</button>
              <button onClick={onCancelCompany} className="flex-1 bg-zinc-700 hover:bg-zinc-600 text-white px-3 py-2 rounded text-sm">Cancel</button>
            </div>
          </div>

          <div className="border-b border-zinc-700 pb-4">
            <h3 className="text-lg font-semibold text-orange-400 mb-3">Invoice Design & Details</h3>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-zinc-400">Logo URL</label>
                <input
                  type="text"
                  value={draft.invoiceLogoUrl}
                  onChange={(e) => onDraftChange("invoiceLogoUrl", e.target.value)}
                  placeholder="Add logo image URL"
                  className="w-full mt-1 bg-zinc-800 border border-zinc-700 rounded p-2 text-white"
                />
              </div>
              <div>
                <label className="text-xs text-zinc-400">Bank Account</label>
                <input
                  type="text"
                  value={draft.invoiceBankAccount}
                  onChange={(e) => onDraftChange("invoiceBankAccount", e.target.value)}
                  placeholder="Add bank account"
                  className="w-full mt-1 bg-zinc-800 border border-zinc-700 rounded p-2 text-white"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-zinc-400">IBAN</label>
                  <input
                    type="text"
                    value={draft.invoiceIban}
                    onChange={(e) => onDraftChange("invoiceIban", e.target.value)}
                    placeholder="Add IBAN"
                    className="w-full mt-1 bg-zinc-800 border border-zinc-700 rounded p-2 text-white"
                  />
                </div>
                <div>
                  <label className="text-xs text-zinc-400">BIC/SWIFT</label>
                  <input
                    type="text"
                    value={draft.invoiceBic}
                    onChange={(e) => onDraftChange("invoiceBic", e.target.value)}
                    placeholder="Add BIC"
                    className="w-full mt-1 bg-zinc-800 border border-zinc-700 rounded p-2 text-white"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs text-zinc-400">Payment Terms</label>
                <input
                  type="text"
                  value={draft.invoicePaymentTerms}
                  onChange={(e) => onDraftChange("invoicePaymentTerms", e.target.value)}
                  placeholder="Example: Pay within 14 days"
                  className="w-full mt-1 bg-zinc-800 border border-zinc-700 rounded p-2 text-white"
                />
              </div>
              <div>
                <label className="text-xs text-zinc-400">Footer Note</label>
                <textarea
                  value={draft.invoiceFooterNote}
                  onChange={(e) => onDraftChange("invoiceFooterNote", e.target.value)}
                  placeholder="Add thank-you note or legal footer"
                  className="w-full mt-1 bg-zinc-800 border border-zinc-700 rounded p-2 text-white min-h-20"
                />
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={onSaveInvoice} className="flex-1 bg-orange-500 hover:bg-orange-600 text-black px-3 py-2 rounded font-semibold text-sm">Save Changes</button>
              <button onClick={onCancelInvoice} className="flex-1 bg-zinc-700 hover:bg-zinc-600 text-white px-3 py-2 rounded text-sm">Cancel</button>
            </div>
          </div>

          <div className="pb-4">
            <h3 className="text-lg font-semibold text-orange-400 mb-3">App Preferences</h3>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-zinc-400">Default invoice email</label>
                <input
                  type="email"
                  value={draft.defaultInvoiceEmail}
                  onChange={(e) => onDraftChange("defaultInvoiceEmail", e.target.value)}
                  className="w-full mt-1 bg-zinc-800 border border-zinc-700 rounded p-2 text-white"
                />
              </div>
              <label className="flex items-center gap-2 text-sm text-zinc-200">
                <input
                  type="checkbox"
                  checked={draft.confirmBeforeDelete}
                  onChange={(e) => onDraftChange("confirmBeforeDelete", e.target.checked)}
                />
                Confirm before deleting items
              </label>
              <label className="flex items-center gap-2 text-sm text-zinc-200">
                <input
                  type="checkbox"
                  checked={draft.autoOpenActivityLog}
                  onChange={(e) => onDraftChange("autoOpenActivityLog", e.target.checked)}
                />
                Auto-open activity log on actions
              </label>
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={onSavePreferences} className="flex-1 bg-orange-500 hover:bg-orange-600 text-black px-3 py-2 rounded font-semibold text-sm">Save Changes</button>
              <button onClick={onCancelPreferences} className="flex-1 bg-zinc-700 hover:bg-zinc-600 text-white px-3 py-2 rounded text-sm">Cancel</button>
            </div>
          </div>

          <div className="pb-4 border-t border-zinc-700 pt-4">
            <h3 className="text-lg font-semibold text-orange-400 mb-3">Technical Utilities</h3>
            <div className="space-y-2 text-xs text-zinc-400 mb-3">
              <div>User: <span className="text-zinc-200">{debugInfo.activeUser}</span></div>
              <div>Connection: <span className={debugInfo.isOnline ? "text-emerald-300" : "text-amber-300"}>{debugInfo.isOnline ? "Online" : "Offline"}</span></div>
              <div>Items: <span className="text-zinc-200">{debugInfo.itemCount}</span> | Queue: <span className="text-zinc-200">{debugInfo.queuedOperations}</span></div>
              <div>
                Sync API: <span className={debugInfo.syncHealth.lastStatus === "ok" ? "text-emerald-300" : debugInfo.syncHealth.lastStatus === "error" ? "text-rose-300" : "text-zinc-300"}>{debugInfo.syncHealth.lastStatus.toUpperCase()}</span>
                {debugInfo.syncHealth.lastLatencyMs !== null ? <span className="text-zinc-200"> ({debugInfo.syncHealth.lastLatencyMs} ms)</span> : null}
              </div>
              <div>Sync Errors: <span className="text-zinc-200">{debugInfo.syncHealth.errorCount}</span></div>
              <div>Last Synced: <span className="text-zinc-200">{debugInfo.lastSyncedAt ? new Date(debugInfo.lastSyncedAt).toLocaleString() : "Not yet"}</span></div>
              <div className="truncate" title={debugInfo.syncHealth.lastRequestId || "No request id yet"}>Last Request ID: <span className="text-zinc-200">{debugInfo.syncHealth.lastRequestId || "N/A"}</span></div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button onClick={onRunSyncNow} className="bg-zinc-700 hover:bg-zinc-600 text-white px-3 py-2 rounded text-sm">Run Sync Now</button>
              <button onClick={onCopyLastRequestId} className="bg-zinc-700 hover:bg-zinc-600 text-white px-3 py-2 rounded text-sm">Copy Request ID</button>
              <button onClick={onCopyTechnicalSnapshot} className="bg-zinc-700 hover:bg-zinc-600 text-white px-3 py-2 rounded text-sm">Copy Snapshot</button>
              <button onClick={onResetSyncErrors} className="bg-zinc-700 hover:bg-zinc-600 text-white px-3 py-2 rounded text-sm">Reset Error Count</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* --------------- INVOICE PREVIEW MODAL --------------- */

function InvoicePreviewModal({
  item,
  settings,
  onClose,
  onSave,
  onPrint,
  onMail,
}: {
  item: Item;
  settings: AppSettings;
  onClose: () => void;
  onSave: () => void;
  onPrint: () => void;
  onMail: () => void;
}) {
  const [failedLogoUrl, setFailedLogoUrl] = useState("");

  const valueOrPlaceholder = (value: string, placeholder: string) => {
    const trimmed = value?.trim();
    return trimmed && trimmed.length > 0 ? trimmed : placeholder;
  };

  const companyName = valueOrPlaceholder(settings.companyName, "ADD COMPANY NAME");
  const companyAddress = valueOrPlaceholder(settings.companyAddress, "ADD COMPANY ADDRESS");
  const companyEmail = valueOrPlaceholder(settings.companyEmail, "ADD COMPANY EMAIL");
  const companyPhone = valueOrPlaceholder(settings.companyPhone, "ADD COMPANY PHONE");
  const companyVAT = valueOrPlaceholder(settings.companyVAT, "ADD VAT NUMBER");
  const bankAccount = valueOrPlaceholder(settings.invoiceBankAccount, "ADD BANK ACCOUNT");
  const iban = valueOrPlaceholder(settings.invoiceIban, "ADD IBAN");
  const bic = valueOrPlaceholder(settings.invoiceBic, "ADD BIC/SWIFT");
  const paymentTerms = valueOrPlaceholder(settings.invoicePaymentTerms, "ADD PAYMENT TERMS");
  const footerNote = valueOrPlaceholder(settings.invoiceFooterNote, "ADD INVOICE FOOTER NOTE");
  const logoUrl = settings.invoiceLogoUrl.trim();
  const showLogo = logoUrl.length > 0 && failedLogoUrl !== logoUrl;

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-zinc-900 rounded-2xl max-w-5xl w-full max-h-[90vh] overflow-auto">
        <div className="sticky top-0 bg-zinc-800 border-b border-zinc-700 p-4 flex justify-between items-center">
          <h2 className="text-xl font-bold text-orange-400">Invoice Preview - {item.name}</h2>
          <button onClick={onClose} className="text-zinc-400 hover:text-orange-400 text-2xl">✕</button>
        </div>

        <div className="p-6 bg-zinc-950">
          <div className="mx-auto bg-white text-zinc-900 w-[210mm] min-h-[297mm] max-w-full p-10 shadow-xl border border-zinc-300">
            <div className="flex justify-between items-start gap-8 mb-8">
              <div>
                <h1 className="text-3xl font-bold tracking-wide">INVOICE</h1>
                <p className="text-sm text-zinc-600 mt-2">Invoice #: INV-{item.code}</p>
                <p className="text-sm text-zinc-600">Issue Date: {item.dateAdded}</p>
              </div>
              <div className="w-44 h-24 border border-dashed border-zinc-400 bg-zinc-100 flex items-center justify-center text-xs text-zinc-500 text-center">
                {showLogo ? (
                  <Image
                    key={logoUrl}
                    src={logoUrl}
                    width={176}
                    height={96}
                    unoptimized
                    alt="Company logo"
                    className="max-h-full max-w-full object-contain"
                    onError={() => setFailedLogoUrl(logoUrl)}
                  />
                ) : (
                  <span>IMAGE / ADD LOGO URL</span>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-8 mb-8 text-sm">
              <div>
                <h3 className="text-xs font-semibold tracking-wider text-zinc-500 mb-2">FROM</h3>
                <p>{companyName}</p>
                <p>{companyAddress}</p>
                <p>{companyEmail}</p>
                <p>{companyPhone}</p>
                <p>VAT: {companyVAT}</p>
              </div>
              <div>
                <h3 className="text-xs font-semibold tracking-wider text-zinc-500 mb-2">BILL TO</h3>
                <p>ADD CUSTOMER NAME</p>
                <p>ADD CUSTOMER ADDRESS</p>
                <p>ADD CUSTOMER EMAIL</p>
              </div>
            </div>

            <table className="w-full border-collapse text-sm mb-8">
              <thead>
                <tr className="bg-zinc-100">
                  <th className="border border-zinc-300 p-2 text-left">Item</th>
                  <th className="border border-zinc-300 p-2 text-left">Category</th>
                  <th className="border border-zinc-300 p-2 text-left">Condition</th>
                  <th className="border border-zinc-300 p-2 text-left">Location</th>
                  <th className="border border-zinc-300 p-2 text-left">Dimensions</th>
                  <th className="border border-zinc-300 p-2 text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="border border-zinc-300 p-2">
                    <div>{item.name}</div>
                    <div className="text-xs text-zinc-500">{item.code}</div>
                  </td>
                  <td className="border border-zinc-300 p-2">{item.category}</td>
                  <td className="border border-zinc-300 p-2">{item.condition}</td>
                  <td className="border border-zinc-300 p-2">{item.location}</td>
                  <td className="border border-zinc-300 p-2">{item.width} × {item.height} × {item.depth} cm</td>
                  <td className="border border-zinc-300 p-2 text-right">{formatEuro(item.price)}</td>
                </tr>
              </tbody>
              <tfoot>
                <tr>
                  <td className="border border-zinc-300 p-2 text-right font-semibold" colSpan={5}>Total</td>
                  <td className="border border-zinc-300 p-2 text-right font-semibold">{formatEuro(item.price)}</td>
                </tr>
              </tfoot>
            </table>

            <div className="border border-zinc-300 rounded-md p-4 bg-zinc-50 text-sm">
              <h3 className="text-xs font-semibold tracking-wider text-zinc-500 mb-2">PAYMENT DETAILS</h3>
              <p>Bank Account: {bankAccount}</p>
              <p>IBAN: {iban}</p>
              <p>BIC/SWIFT: {bic}</p>
              <p>Payment Terms: {paymentTerms}</p>
            </div>

            <div className="mt-6 pt-3 border-t border-zinc-300 text-xs text-zinc-600">
              {footerNote}
            </div>
          </div>
        </div>

        <div className="sticky bottom-0 bg-zinc-800 border-t border-zinc-700 p-4 flex gap-3 justify-end">
          <button onClick={onClose} className="px-4 py-2 bg-zinc-700 hover:bg-zinc-600 text-white rounded" aria-label="Close">✕</button>
          <button onClick={onMail} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded">Mail</button>
          <button onClick={onPrint} className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded">Print</button>
          <button onClick={onSave} className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-black rounded font-semibold">Save PDF</button>
        </div>
      </div>
    </div>
  );
}
