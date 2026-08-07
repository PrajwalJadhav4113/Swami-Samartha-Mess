"use client";

import React, { useState, useEffect } from "react";
import { useToast } from "@/components/ui/Toast";
import { PlusCircle, Edit2, Trash2, Check, X, Loader2, Menu as MenuIcon, CircleDollarSign } from "lucide-react";

interface MenuItem {
  _id: string;
  name: string;
  category: string;
  price: number;
  isActive: boolean;
}

export default function MenuMaster() {
  const { success, error } = useToast();
  const [items, setItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Form states
  const [name, setName] = useState("");
  const [category, setCategory] = useState("Tiffin");
  const [price, setPrice] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Edit states
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editCategory, setEditCategory] = useState("");
  const [editPrice, setEditPrice] = useState("");
  const [editIsActive, setEditIsActive] = useState(true);
  const [updating, setUpdating] = useState(false);

  const fetchMenuItems = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/owner/menu");
      if (!res.ok) throw new Error("Failed to fetch menu list");
      const data = await res.json();
      setItems(data);
    } catch (err: any) {
      error(err.message || "Failed to load menu items");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMenuItems();
  }, []);

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !price) {
      error("Name and Price are required fields");
      return;
    }
    const numPrice = parseFloat(price);
    if (isNaN(numPrice) || numPrice < 0) {
      error("Price must be a valid positive number");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/owner/menu", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, category, price: numPrice }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to add menu item");

      success(`Menu item "${name}" created!`);
      setName("");
      setPrice("");
      setShowAddForm(false);
      fetchMenuItems();
    } catch (err: any) {
      error(err.message || "Error adding menu item");
    } finally {
      setSubmitting(false);
    }
  };

  const handleStartEdit = (item: MenuItem) => {
    setEditingId(item._id);
    setEditName(item.name);
    setEditCategory(item.category);
    setEditPrice(item.price.toString());
    setEditIsActive(item.isActive);
  };

  const handleSaveEdit = async (id: string) => {
    if (!editName || !editPrice) {
      error("Name and Price cannot be blank");
      return;
    }
    const numPrice = parseFloat(editPrice);
    if (isNaN(numPrice) || numPrice < 0) {
      error("Price must be a valid positive number");
      return;
    }

    setUpdating(true);
    try {
      const res = await fetch(`/api/owner/menu/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editName,
          category: editCategory,
          price: numPrice,
          isActive: editIsActive,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update item");

      success(`Menu item "${editName}" updated successfully`);
      setEditingId(null);
      fetchMenuItems();
    } catch (err: any) {
      error(err.message || "Error saving menu item modifications");
    } finally {
      setUpdating(false);
    }
  };

  const handleDeleteItem = async (id: string, itemName: string) => {
    if (!confirm(`Are you sure you want to delete "${itemName}"? This will impact pricing configs for future records.`)) return;
    try {
      const res = await fetch(`/api/owner/menu/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to delete item");
      }
      success(`Menu item "${itemName}" deleted successfully`);
      fetchMenuItems();
    } catch (err: any) {
      error(err.message || "Error deleting item");
    }
  };

  const handleToggleStatus = async (item: MenuItem) => {
    try {
      const res = await fetch(`/api/owner/menu/${item._id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !item.isActive }),
      });
      if (res.ok) {
        success(`"${item.name}" is now ${!item.isActive ? "Active" : "Inactive"}`);
        fetchMenuItems();
      } else {
        throw new Error();
      }
    } catch (err) {
      error("Failed to toggle status");
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Title Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Menu Master</h2>
          <p className="text-sm text-muted-foreground">
            Configure items and prices dynamically. Add unlimited new items without modifying code.
          </p>
        </div>
        <button
          onClick={() => setShowAddForm(true)}
          className="inline-flex items-center gap-2 bg-primary hover:bg-primary/95 text-white font-semibold px-4 py-2.5 rounded-xl hover-lift shadow-md transition self-start cursor-pointer"
        >
          <PlusCircle className="h-4.5 w-4.5" />
          <span>Add Menu Item</span>
        </button>
      </div>

      {/* Add Item Modal */}
      {showAddForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-card border border-border rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-border flex items-center justify-between">
              <h3 className="font-bold text-base">New Menu Configuration</h3>
              <button
                onClick={() => setShowAddForm(false)}
                className="text-muted-foreground hover:text-foreground text-sm font-semibold px-2 py-1 rounded-lg hover:bg-muted"
              >
                Close
              </button>
            </div>
            
            <form onSubmit={handleAddSubmit} className="p-6 space-y-4">
              <div>
                <label className="text-xs font-bold text-muted-foreground uppercase block mb-1">
                  Item Name
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Festival Special Sweet"
                  className="w-full px-3 py-2 bg-muted border border-transparent rounded-lg focus:border-primary/20 focus:bg-card focus:outline-none transition text-sm font-semibold"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-muted-foreground uppercase block mb-1">
                    Category
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full px-3 py-2 bg-muted border border-transparent rounded-lg focus:outline-none focus:bg-card text-sm font-semibold"
                  >
                    <option value="Tiffin">Tiffin</option>
                    <option value="Extra">Extra</option>
                    <option value="Beverage">Beverage</option>
                    <option value="Sweet">Sweet</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold text-muted-foreground uppercase block mb-1">
                    Price (₹)
                  </label>
                  <input
                    type="number"
                    required
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    placeholder="e.g. 60"
                    className="w-full px-3 py-2 bg-muted border border-transparent rounded-lg focus:border-primary/20 focus:bg-card focus:outline-none transition text-sm font-semibold"
                  />
                </div>
              </div>

              <div className="border-t border-border pt-4 flex gap-3 justify-end">
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="px-4 py-2 border border-border hover:bg-muted text-sm font-semibold rounded-xl transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-primary hover:bg-primary/95 text-white font-semibold text-sm rounded-xl hover-lift shadow transition flex items-center gap-1.5 cursor-pointer"
                >
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  <span>Save Configuration</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Menu list Table */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <Loader2 className="h-8 w-8 text-primary animate-spin" />
          <p className="text-sm text-muted-foreground">Loading menu configuration...</p>
        </div>
      ) : items.length === 0 ? (
        <div className="bg-card border border-border p-12 text-center rounded-2xl">
          <MenuIcon className="h-10 w-10 text-muted-foreground/60 mx-auto mb-3" />
          <h4 className="font-bold text-sm">No Menu Items Configured</h4>
          <p className="text-xs text-muted-foreground max-w-xs mx-auto mt-1">
            Build your active prices master. Register your first item using the button above.
          </p>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
          {/* Desktop view */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30 text-muted-foreground text-xs font-bold uppercase">
                  <th className="px-6 py-4">Item Name</th>
                  <th className="px-6 py-4">Category</th>
                  <th className="px-6 py-4">Price (₹)</th>
                  <th className="px-6 py-4">Active Status</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border font-medium">
                {items.map((item) => {
                  const isEditing = editingId === item._id;

                  return (
                    <tr key={item._id} className="hover:bg-muted/20 transition">
                      <td className="px-6 py-4">
                        {isEditing ? (
                          <input
                            type="text"
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            className="px-2.5 py-1.5 bg-muted border border-transparent rounded-lg focus:border-primary/20 focus:bg-card focus:outline-none text-sm font-semibold w-full max-w-xs"
                          />
                        ) : (
                          <span className="font-bold">{item.name}</span>
                        )}
                      </td>

                      <td className="px-6 py-4">
                        {isEditing ? (
                          <select
                            value={editCategory}
                            onChange={(e) => setEditCategory(e.target.value)}
                            className="px-2.5 py-1.5 bg-muted border border-transparent rounded-lg text-sm font-semibold focus:outline-none focus:bg-card"
                          >
                            <option value="Tiffin">Tiffin</option>
                            <option value="Extra">Extra</option>
                            <option value="Beverage">Beverage</option>
                            <option value="Sweet">Sweet</option>
                          </select>
                        ) : (
                          <span className="text-xs font-bold bg-muted px-2.5 py-1 rounded-full border border-border">
                            {item.category}
                          </span>
                        )}
                      </td>

                      <td className="px-6 py-4">
                        {isEditing ? (
                          <input
                            type="number"
                            value={editPrice}
                            onChange={(e) => setEditPrice(e.target.value)}
                            className="px-2.5 py-1.5 bg-muted border border-transparent rounded-lg focus:border-primary/20 focus:bg-card focus:outline-none text-sm font-semibold w-24"
                          />
                        ) : (
                          <span className="text-emerald-600 font-extrabold">₹{item.price}</span>
                        )}
                      </td>

                      <td className="px-6 py-4">
                        {isEditing ? (
                          <div className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              id={`edit-active-${item._id}`}
                              checked={editIsActive}
                              onChange={(e) => setEditIsActive(e.target.checked)}
                              className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                            />
                            <label htmlFor={`edit-active-${item._id}`} className="text-xs font-semibold">Active</label>
                          </div>
                        ) : (
                          <button
                            onClick={() => handleToggleStatus(item)}
                            className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full cursor-pointer transition ${
                              item.isActive
                                ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400"
                                : "bg-zinc-100 text-zinc-800 dark:bg-zinc-900/60 dark:text-zinc-400"
                            }`}
                          >
                            {item.isActive ? "Active" : "Disabled"}
                          </button>
                        )}
                      </td>

                      <td className="px-6 py-4 text-right">
                        {isEditing ? (
                          <div className="flex justify-end gap-2">
                            <button
                              onClick={() => handleSaveEdit(item._id)}
                              disabled={updating}
                              className="p-1.5 rounded-lg border border-emerald-200 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/20 cursor-pointer"
                              title="Save changes"
                            >
                              <Check className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => setEditingId(null)}
                              className="p-1.5 rounded-lg border border-zinc-200 text-zinc-600 hover:bg-zinc-50 dark:hover:bg-zinc-900/30 cursor-pointer"
                              title="Cancel"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </div>
                        ) : (
                          <div className="flex justify-end gap-2">
                            <button
                              onClick={() => handleStartEdit(item)}
                              className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer"
                              title="Edit item"
                            >
                              <Edit2 className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteItem(item._id, item.name)}
                              className="p-1.5 rounded-lg text-rose-500 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/20 cursor-pointer"
                              title="Delete item"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile view */}
          <div className="block md:hidden divide-y divide-border">
            {items.map((item) => {
              const isEditing = editingId === item._id;
              return (
                <div key={item._id} className="p-4 space-y-3">
                  <div className="flex justify-between items-start gap-2">
                    <div className="flex-grow min-w-0">
                      {isEditing ? (
                        <input
                          type="text"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          className="px-2.5 py-1.5 bg-muted border border-transparent rounded-lg focus:border-primary/20 focus:bg-card focus:outline-none text-sm font-semibold w-full"
                        />
                      ) : (
                        <span className="font-bold text-sm block truncate">{item.name}</span>
                      )}
                      
                      <div className="flex gap-2 mt-1.5">
                        {isEditing ? (
                          <select
                            value={editCategory}
                            onChange={(e) => setEditCategory(e.target.value)}
                            className="px-2 py-1 bg-muted border border-transparent rounded-lg text-xs font-semibold focus:outline-none focus:bg-card"
                          >
                            <option value="Tiffin">Tiffin</option>
                            <option value="Extra">Extra</option>
                            <option value="Beverage">Beverage</option>
                            <option value="Sweet">Sweet</option>
                          </select>
                        ) : (
                          <span className="text-[10px] font-bold bg-muted px-2 py-0.5 rounded border border-border">
                            {item.category}
                          </span>
                        )}

                        {!isEditing && (
                          <button
                            onClick={() => handleToggleStatus(item)}
                            className={`text-[10px] font-bold px-2 py-0.5 rounded cursor-pointer transition ${
                              item.isActive
                                ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400"
                                : "bg-zinc-100 text-zinc-800 dark:bg-zinc-900/60 dark:text-zinc-400"
                            }`}
                          >
                            {item.isActive ? "Active" : "Disabled"}
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="text-right flex-shrink-0">
                      {isEditing ? (
                        <input
                          type="number"
                          value={editPrice}
                          onChange={(e) => setEditPrice(e.target.value)}
                          className="px-2 py-1.5 bg-muted border border-transparent rounded-lg focus:border-primary/20 focus:bg-card focus:outline-none text-sm font-semibold w-16 text-right"
                        />
                      ) : (
                        <span className="text-emerald-600 font-extrabold text-sm block">₹{item.price}</span>
                      )}
                    </div>
                  </div>

                  {isEditing && (
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id={`edit-active-mob-${item._id}`}
                        checked={editIsActive}
                        onChange={(e) => setEditIsActive(e.target.checked)}
                        className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                      />
                      <label htmlFor={`edit-active-mob-${item._id}`} className="text-xs font-semibold">Active Status</label>
                    </div>
                  )}

                  <div className="flex justify-end gap-2 border-t border-border/40 pt-2.5">
                    {isEditing ? (
                      <>
                        <button
                          onClick={() => handleSaveEdit(item._id)}
                          disabled={updating}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-600 text-xs font-bold rounded-lg border border-emerald-250 cursor-pointer"
                        >
                          <Check className="h-3.5 w-3.5" />
                          <span>Save</span>
                        </button>
                        <button
                          onClick={() => setEditingId(null)}
                          className="flex items-center gap-1.5 px-3 py-1.5 border border-border text-muted-foreground hover:bg-muted text-xs font-semibold rounded-lg cursor-pointer"
                        >
                          <X className="h-3.5 w-3.5" />
                          <span>Cancel</span>
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() => handleStartEdit(item)}
                          className="flex items-center gap-1.5 px-3 py-1.5 border border-border bg-card hover:bg-muted text-xs font-semibold rounded-lg transition cursor-pointer"
                        >
                          <Edit2 className="h-3.5 w-3.5 text-muted-foreground" />
                          <span>Edit</span>
                        </button>
                        <button
                          onClick={() => handleDeleteItem(item._id, item.name)}
                          className="flex items-center gap-1.5 px-3 py-1.5 border border-rose-250 text-rose-500 hover:bg-rose-50 text-xs font-bold rounded-lg cursor-pointer"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          <span>Delete</span>
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
