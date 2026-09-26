import { useState, useEffect, useMemo, useRef } from 'react';
import {
    DndContext,
    useSensor,
    useSensors,
    PointerSensor,
    DragOverlay,
    closestCorners,
    defaultDropAnimationSideEffects,
    useDroppable
} from '@dnd-kit/core';
import {
    SortableContext,
    verticalListSortingStrategy,
    useSortable,
    arrayMove
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { createPortal } from 'react-dom';
import NewManufacturingOrderModal from '../../../components/NewManufacturingOrderModal';

const Manufacturing = () => {
    const [orders, setOrders] = useState([]);
    const [customers, setCustomers] = useState([]);
    const [customersLoading, setCustomersLoading] = useState(false);
    const [staff, setStaff] = useState([]);
    const [staffLoading, setStaffLoading] = useState(false);
    const [activeId, setActiveId] = useState(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [selectedOrder, setSelectedOrder] = useState(null);
    const [loading, setLoading] = useState(true);
    const dragOriginStatusRef = useRef(null);

    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 8,
            },
        })
    );

    const columns = [
        { title: 'New Orders', id: 'New Orders', color: 'border-blue-500/50', badge: 'bg-blue-500/10 text-blue-400' },
        { title: 'In Progress (Molding)', id: 'In Progress', color: 'border-yellow-500/50', badge: 'bg-yellow-500/10 text-yellow-400' },
        { title: 'Polishing & QC', id: 'Polishing & QC', color: 'border-purple-500/50', badge: 'bg-purple-500/10 text-purple-400' },
        { title: 'Ready for Delivery', id: 'Ready for Delivery', color: 'border-green-500/50', badge: 'bg-green-500/10 text-green-400' }
    ];

    const fetchOrders = async () => {
        try {
            const activeBranch = localStorage.getItem('activeBranch') || 'Main Branch';
            const userId = localStorage.getItem('userId');
            const shopownerId = localStorage.getItem('shopownerId');
            const queryParam = shopownerId ? `shopownerId=${shopownerId}` : `userId=${userId}`;
            const response = await fetch(`/api/manufacturing?branch=${encodeURIComponent(activeBranch)}&${queryParam}`);
            const data = await response.json();
            if (Array.isArray(data)) {
                setOrders(data);
            } else {
                console.error("API response is not an array:", data);
                setOrders([]);
            }
        } catch (error) {
            console.error("Failed to fetch orders:", error);
        } finally {
            setLoading(false);
        }
    };

    const fetchCustomers = async () => {
        try {
            setCustomersLoading(true);
            const activeBranch = localStorage.getItem('activeBranch') || 'Main Branch';
            const userId = localStorage.getItem('userId');
            const shopownerId = localStorage.getItem('shopownerId');
            const queryParam = shopownerId ? `shopownerId=${shopownerId}` : `userId=${userId}`;
            const response = await fetch(`/api/customers?branch=${encodeURIComponent(activeBranch)}&${queryParam}`);
            const data = await response.json();
            if (Array.isArray(data)) {
                setCustomers(data);
            } else {
                setCustomers([]);
            }
        } catch (error) {
            console.error("Failed to fetch customers:", error);
            setCustomers([]);
        } finally {
            setCustomersLoading(false);
        }
    };

    const fetchStaff = async () => {
        try {
            setStaffLoading(true);
            const activeBranch = localStorage.getItem('activeBranch') || 'Main Branch';
            const userId = localStorage.getItem('userId');
            const shopownerId = localStorage.getItem('shopownerId');
            const queryParam = shopownerId ? `shopownerId=${shopownerId}` : `userId=${userId}`;
            const response = await fetch(`/api/staff?branch=${encodeURIComponent(activeBranch)}&${queryParam}`);
            const data = await response.json();
            if (Array.isArray(data)) {
                setStaff(data);
            } else {
                setStaff([]);
            }
        } catch (error) {
            console.error("Failed to fetch staff:", error);
            setStaff([]);
        } finally {
            setStaffLoading(false);
        }
    };

    useEffect(() => {
        fetchOrders();
        fetchCustomers();
        fetchStaff();
    }, []);

    const handleCreateOrder = async (orderData) => {
        const newOrder = {
            ...orderData,
            order_id: `MF-${Date.now().toString().slice(-4)}`,
            status: 'New Orders',
            // Assign a temporary unique ID for dnd-kit until backend returns one
            id: Date.now()
        };

        try {
            const activeBranch = localStorage.getItem('activeBranch') || 'Main Branch';
            const userId = localStorage.getItem('userId');
            const shopownerId = localStorage.getItem('shopownerId');
            const response = await fetch('/api/manufacturing', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...newOrder, branch: activeBranch, userId, shopownerId })
            });

            if (response.ok) {
                const savedOrder = await response.json();
                setOrders([savedOrder, ...orders]);
                setIsModalOpen(false);
            }
        } catch (error) {
            console.error("Failed to create order:", error);
            // Optimistic add failure handling could go here
        }
    };

    // Helper to find column for an item
    const findColumn = (id) => {
        const order = orders.find(o => o.id === id);
        return order ? order.status : null;
    };

    const handleDragStart = (event) => {
        const startingOrder = orders.find(o => o.id === event.active.id);
        dragOriginStatusRef.current = startingOrder ? startingOrder.status : null;
        setActiveId(event.active.id);
    };

    const handleDragOver = (event) => {
        const { active, over } = event;
        if (!over) return;

        const activeId = active.id;
        const overId = over.id;

        const activeColumn = findColumn(activeId);
        const overColumn = findColumn(overId) || (columns.find(c => c.id === overId)?.id);

        if (!activeColumn || !overColumn || activeColumn === overColumn) {
            return;
        }

        // Updating state during drag for smoothness
        const activeOrder = orders.find(o => o.id === activeId);

        // Update the order's status to the new column immediately for visual feedback
        setOrders((prev) => {
            return prev.map(o => {
                if (o.id === activeId) {
                    return { ...o, status: overColumn };
                }
                return o;
            });
        });
    };

    const handleDragEnd = async (event) => {
        const { active, over } = event;
        const activeId = active.id;
        const overId = over ? over.id : null;

        setActiveId(null);

        const originalStatus = dragOriginStatusRef.current;
        dragOriginStatusRef.current = null;

        if (!over) {
            if (originalStatus) {
                setOrders((prev) =>
                    prev.map((o) => (o.id === activeId ? { ...o, status: originalStatus } : o))
                );
            }
            return;
        }

        const activeColumn = originalStatus || findColumn(activeId);
        const overColumn = findColumn(overId) || (columns.find(c => c.id === overId)?.id);

        // If the item dropped in the same column but different position (sorting)
        // or just dropped in a valid column
        if (activeColumn && overColumn) {
            const activeIndex = orders.findIndex(o => o.id === activeId);
            const overIndex = orders.findIndex(o => o.id === overId);

            if (overIndex >= 0 && activeIndex !== overIndex) {
                setOrders((items) => arrayMove(items, activeIndex, overIndex));
            }

            // Update Backend with new status (and potentially order index if backend supports it)
            // Check if status changed
            const currentOrder = orders.find(o => o.id === activeId);
            if (currentOrder && activeColumn !== overColumn) {
                // Final update ensuring status is set correctly
                const updatedOrders = orders.map(o =>
                    o.id === activeId ? { ...o, status: overColumn } : o
                );
                setOrders(updatedOrders);

                try {
                    await fetch(`/api/manufacturing/${activeId}/status`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ status: overColumn })
                    });
                } catch (error) {
                    console.error("Failed to update status:", error);
                    fetchOrders(); // Revert
                }
            } else if (currentOrder && currentOrder.status === overColumn) {
                // Even if status didn't change, we might want to create a PUT request if we were persisting sort order
                // For now, no backend sort order persistence, so we just assume client sort is temporary
            }
        }
    };

    const handleOpenEditModal = (order) => {
        setSelectedOrder(order);
        setIsEditModalOpen(true);
    };

    const handleCloseEditModal = () => {
        setIsEditModalOpen(false);
        setSelectedOrder(null);
    };

    const handleUpdateOrder = async (updatedData) => {
        if (!selectedOrder?.id) return;

        try {
            const response = await fetch(`/api/manufacturing/${selectedOrder.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updatedData)
            });

            if (!response.ok) {
                throw new Error('Failed to update manufacturing order');
            }

            const updatedOrder = await response.json();
            setOrders((prev) => prev.map((order) => (
                order.id === updatedOrder.id ? updatedOrder : order
            )));
            handleCloseEditModal();
        } catch (error) {
            console.error('Failed to update order:', error);
        }
    };

    const handleDeleteOrder = async () => {
        if (!selectedOrder?.id) return;

        try {
            const response = await fetch(`/api/manufacturing/${selectedOrder.id}`, {
                method: 'DELETE'
            });

            if (!response.ok) {
                throw new Error('Failed to delete manufacturing order');
            }

            setOrders((prev) => prev.filter((order) => order.id !== selectedOrder.id));
            handleCloseEditModal();
        } catch (error) {
            console.error('Failed to delete order:', error);
        }
    };

    const totalGold = orders.reduce((sum, order) => sum + (order.gold_weight || 0), 0);

    const activeOrder = activeId ? orders.find(o => o.id === activeId) : null;
    const activeOrderBadge = activeOrder ? columns.find(c => c.id === activeOrder.status)?.badge : '';

    const dropAnimation = {
        sideEffects: defaultDropAnimationSideEffects({
            styles: {
                active: {
                    opacity: '0.5',
                },
            },
        }),
    };

    return (
        <div className="space-y-8 animate-fade-in h-[calc(100vh-8rem)] flex flex-col">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-white">Manufacturing Workflow</h1>
                    <p className="text-gray-400 mt-1">Track production from order to delivery.</p>
                </div>
                <div className="flex flex-col sm:flex-row gap-4 w-full md:w-auto">
                    <div className="bg-[#121418] px-4 py-2 rounded-lg border border-white/10 text-sm flex justify-between sm:justify-start gap-2">
                        <span className="text-gray-400">Total Gold Allocated:</span>
                        <span className="text-primary-gold font-bold">{totalGold.toFixed(2)} g</span>
                    </div>
                    <button
                        onClick={() => setIsModalOpen(true)}
                        className="bg-primary-gold text-black px-6 py-2 rounded-xl font-bold hover:bg-yellow-400 transition-colors w-full sm:w-auto shadow-lg shadow-primary-gold/20"
                    >
                        New Order
                    </button>
                </div>
            </div>

            <DndContext
                sensors={sensors}
                collisionDetection={closestCorners}
                onDragStart={handleDragStart}
                onDragOver={handleDragOver}
                onDragEnd={handleDragEnd}
            >
                <div className="flex-1 overflow-x-auto pb-4">
                    <div className="flex gap-6 h-full min-w-[1000px]">
                        {columns.map((column) => (
                            <DroppableColumn
                                key={column.id}
                                column={column}
                                items={orders.filter(o => o.status === column.id)}
                                onItemClick={handleOpenEditModal}
                            />
                        ))}
                    </div>
                </div>

                {createPortal(
                    <DragOverlay dropAnimation={dropAnimation}>
                        {activeOrder ? (
                            <OrderCard item={activeOrder} badgeColor={activeOrderBadge} isOverlay />
                        ) : null}
                    </DragOverlay>,
                    document.body
                )}
            </DndContext>

            <NewManufacturingOrderModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSave={handleCreateOrder}
                customers={customers}
                customersLoading={customersLoading}
                staff={staff}
                staffLoading={staffLoading}
            />

            <NewManufacturingOrderModal
                isOpen={isEditModalOpen}
                mode="edit"
                initialData={selectedOrder}
                onClose={handleCloseEditModal}
                onSave={handleUpdateOrder}
                onDelete={handleDeleteOrder}
                customers={customers}
                customersLoading={customersLoading}
                staff={staff}
                staffLoading={staffLoading}
            />
        </div>
    );
};

const DroppableColumn = ({ column, items, onItemClick }) => {
    const { setNodeRef } = useDroppable({
        id: column.id,
    });

    // We sort by local index (array order) since we don't have a sort index from DB yet
    const itemIds = useMemo(() => items.map(i => i.id), [items]);

    return (
        <div ref={setNodeRef} className="flex-1 bg-[#121418] rounded-2xl border border-white/5 flex flex-col min-w-[300px] h-full">
            <div className={`p-4 border-b border-white/5 flex justify-between items-center border-t-4 ${column.color} rounded-t-2xl`}>
                <h3 className="font-bold text-white">{column.title}</h3>
                <span className="bg-white/5 text-gray-400 px-2 py-0.5 rounded text-xs">{items.length}</span>
            </div>

            <SortableContext items={itemIds} strategy={verticalListSortingStrategy}>
                <div className="p-4 space-y-3 overflow-y-auto flex-1 custom-scrollbar">
                    {items.map((item) => (
                        <SortableOrderCard
                            key={item.id}
                            item={item}
                            badgeColor={column.badge}
                            onCardClick={onItemClick}
                        />
                    ))}
                    {items.length === 0 && (
                        <div className="h-24 border-2 border-dashed border-white/5 rounded-xl flex items-center justify-center text-gray-600 text-sm">
                            Drop items here
                        </div>
                    )}
                </div>
            </SortableContext>
        </div>
    );
};

const SortableOrderCard = ({ item, badgeColor, onCardClick }) => {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging
    } = useSortable({ id: item.id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.3 : 1,
    };

    return (
        <div ref={setNodeRef} style={style} {...attributes} {...listeners} className="touch-none">
            <OrderCard
                item={item}
                badgeColor={badgeColor}
                onClick={() => !isDragging && onCardClick?.(item)}
            />
        </div>
    );
};

// Separated Card Component for reusability in DragOverlay
const OrderCard = ({ item, badgeColor, isOverlay, onClick }) => {
    return (
        <div
            onClick={onClick}
            className={`
                bg-[#0B0D10] p-4 rounded-xl border border-white/5 
                ${isOverlay ? 'shadow-2xl scale-105 border-primary-gold/50 cursor-grabbing' : 'hover:border-primary-gold/30 cursor-grab'} 
                transition-all group relative z-10
            `}
        >
            <div className="flex justify-between items-start mb-2">
                <span className="text-xs text-gray-500 font-mono">{item.order_id}</span>
                <span className={`text-[10px] px-2 py-0.5 rounded-full ${badgeColor}`}>
                    {item.status}
                </span>
            </div>
            <h4 className="font-bold text-white mb-1 group-hover:text-primary-gold transition-colors">{item.product_name}</h4>
            <div className="flex justify-between items-center">
                <p className="text-sm text-gray-400">{item.customer_name}</p>
                {item.gold_weight > 0 && (
                    <span className="text-xs text-primary-gold/80 font-mono">{item.gold_weight}g</span>
                )}
            </div>

            {item.karigar_name && (
                <div className="flex items-center gap-2 mt-3 pt-3 border-t border-white/5">
                    <div className="w-5 h-5 rounded-full bg-gray-700 flex items-center justify-center text-[10px] text-white">K</div>
                    <span className="text-xs text-gray-400">Karigar: {item.karigar_name}</span>
                </div>
            )}
        </div>
    );
};

export default Manufacturing;
