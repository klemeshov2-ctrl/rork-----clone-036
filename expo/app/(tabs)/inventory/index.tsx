import React, { useState, useMemo, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Alert, Modal, TextInput, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Plus, Package, AlertTriangle, Trash2, Minus, Plus as PlusIcon, ChevronDown, ChevronRight, FolderPlus, Pencil, Tag, Search, ChevronsUpDown, PackagePlus, History, ArrowDownToLine, ArrowUpFromLine, FileSpreadsheet } from 'lucide-react-native';
import { exportInventoryHistory } from '@/lib/excel';
import { useThemeColors } from '@/providers/ThemeProvider';
import { ThemeColors } from '@/constants/colors';
import { useInventory, BulkReceiptItem } from '@/providers/InventoryProvider';
import { InventoryItem, InventoryCategory, InventoryMovement } from '@/types';
import { formatDateTime } from '@/lib/utils';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { VoiceInputButton } from '@/components/VoiceInputButton';
import { parseMaterialVoice } from '@/lib/voiceParser';
import { isLowInventory } from '@/lib/utils';
import { useSubscriberGuard } from '@/providers/ProfileProvider';
import { NotificationBell } from '@/components/NotificationBell';
import { useComments } from '@/providers/CommentsProvider';
import { CommentsBottomSheet } from '@/components/CommentsBottomSheet';
import { MessageCircle } from 'lucide-react-native';

function getShortPreview(text: string, wordCount: number = 3): string {
  if (!text) return '';
  const words = text.trim().split(/\s+/);
  const preview = words.slice(0, wordCount).join(' ');
  return words.length > wordCount ? preview + '...' : preview;
}

function InventoryCard({ item, onUpdate, onDelete, onEdit, onComments, lastComment, commentCount, colors }: { 
  item: InventoryItem; 
  onUpdate: (delta: number) => void;
  onDelete: () => void;
  onEdit: () => void;
  onComments: () => void;
  lastComment?: string;
  commentCount: number;
  colors: ThemeColors;
}) {
  const isLow = isLowInventory(item.quantity, item.minQuantity);
  return (
    <Card style={{ marginBottom: 10, borderLeftWidth: 4, borderLeftColor: isLow ? colors.error : 'transparent' }}>
      <TouchableOpacity activeOpacity={0.7} onPress={onEdit}>
        <View style={{ flexDirection: 'row' as const, justifyContent: 'space-between' as const, alignItems: 'flex-start' as const, marginBottom: 10 }}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 15, fontWeight: '600' as const, color: colors.text }}>{item.name}</Text>
            <Text style={{ fontSize: 12, color: colors.textMuted, marginTop: 2 }}>Единица: {item.unit}</Text>
          </View>
          {isLow && <View style={{ padding: 4 }}><AlertTriangle size={16} color={colors.error} /></View>}
        </View>
      </TouchableOpacity>
      <View style={{ flexDirection: 'row' as const, alignItems: 'center' as const, gap: 14 }}>
        <TouchableOpacity style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: colors.surface, alignItems: 'center' as const, justifyContent: 'center' as const }} onPress={() => onUpdate(-1)}>
          <Minus size={18} color={colors.text} />
        </TouchableOpacity>
        <Text style={[{ fontSize: 22, fontWeight: 'bold' as const, color: colors.text, minWidth: 44, textAlign: 'center' as const }, isLow && { color: colors.error }]}>
          {item.quantity}
        </Text>
        <TouchableOpacity style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: colors.surface, alignItems: 'center' as const, justifyContent: 'center' as const }} onPress={() => onUpdate(1)}>
          <PlusIcon size={18} color={colors.text} />
        </TouchableOpacity>
        <TouchableOpacity style={{ marginLeft: 'auto', padding: 8 }} onPress={onDelete}>
          <Trash2 size={16} color={colors.error} />
        </TouchableOpacity>
      </View>
      <TouchableOpacity onPress={onComments} activeOpacity={0.7} style={{ flexDirection: 'row' as const, alignItems: 'center' as const, marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: colors.border, gap: 8 }}>
        <View style={{ position: 'relative' as const }}>
          <MessageCircle size={16} color={colors.info} />
          {commentCount > 0 && (
            <View style={{ position: 'absolute' as const, top: -5, right: -8, backgroundColor: colors.primary, borderRadius: 7, minWidth: 14, height: 14, alignItems: 'center' as const, justifyContent: 'center' as const, paddingHorizontal: 3 }}>
              <Text style={{ color: '#fff', fontSize: 9, fontWeight: '700' as const }}>{commentCount}</Text>
            </View>
          )}
        </View>
        {lastComment ? (
          <Text style={{ fontSize: 12, color: colors.textSecondary, flex: 1 }} numberOfLines={1}>{getShortPreview(lastComment)}</Text>
        ) : (
          <Text style={{ fontSize: 12, color: colors.textMuted, fontStyle: 'italic' as const }}>Комментарии</Text>
        )}
        <ChevronRight size={14} color={colors.textMuted} />
      </TouchableOpacity>
    </Card>
  );
}

function CategorySection({ category, items, colors, isExpanded, onToggle, onEdit, onDelete, onUpdate, onDeleteItem, onEditItem, onComments, commentsMap }: {
  category: InventoryCategory | null;
  items: InventoryItem[];
  colors: ThemeColors;
  isExpanded: boolean;
  onToggle: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  onUpdate: (item: InventoryItem, delta: number) => void;
  onDeleteItem: (id: string) => void;
  onEditItem: (item: InventoryItem) => void;
  onComments: (itemId: string) => void;
  commentsMap: Record<string, { count: number; lastText: string }>;
}) {
  const title = category ? category.name : 'Без категории';
  return (
    <View style={{ marginBottom: 6 }}>
      <TouchableOpacity onPress={onToggle} style={{ flexDirection: 'row' as const, alignItems: 'center' as const, paddingVertical: 10, gap: 8 }}>
        {isExpanded ? <ChevronDown size={18} color={colors.textSecondary} /> : <ChevronRight size={18} color={colors.textSecondary} />}
        <Tag size={15} color={category ? colors.primary : colors.textMuted} />
        <Text style={{ flex: 1, fontSize: 13, fontWeight: '700' as const, color: colors.text, textTransform: 'uppercase' as const, letterSpacing: 0.5 }}>{title}</Text>
        <Text style={{ fontSize: 12, color: colors.textMuted }}>{items.length}</Text>
        {category && onEdit && (
          <TouchableOpacity onPress={onEdit} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} style={{ padding: 4 }}>
            <Pencil size={14} color={colors.primary} />
          </TouchableOpacity>
        )}
        {category && onDelete && (
          <TouchableOpacity onPress={onDelete} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} style={{ padding: 4 }}>
            <Trash2 size={14} color={colors.error} />
          </TouchableOpacity>
        )}
      </TouchableOpacity>
      {isExpanded && items.map(item => {
        const cInfo = commentsMap[`inventory:${item.id}`];
        return (
          <InventoryCard
            key={item.id}
            item={item}
            onUpdate={(delta) => onUpdate(item, delta)}
            onDelete={() => onDeleteItem(item.id)}
            onEdit={() => onEditItem(item)}
            onComments={() => onComments(item.id)}
            lastComment={cInfo?.lastText}
            commentCount={cInfo?.count || 0}
            colors={colors}
          />
        );
      })}
      {isExpanded && items.length === 0 && (
        <Text style={{ fontSize: 13, color: colors.textMuted, paddingLeft: 40, paddingVertical: 8 }}>Пусто</Text>
      )}
    </View>
  );
}

export default function InventoryScreen() {
  const colors = useThemeColors();
  const { items, categories, movements, isLoading, addItem, updateItem, deleteItem, bulkReceipt, deleteMovement, addCategory, updateCategory, deleteCategory } = useInventory();
  const [activeTab, setActiveTab] = useState<'stock' | 'history'>('stock');
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [bulkRows, setBulkRows] = useState<{ itemId: string; itemName: string; unit: string; quantity: string }[]>([]);
  const [bulkComment, setBulkComment] = useState('');
  const [bulkPickerVisible, setBulkPickerVisible] = useState(false);
  const [bulkPickerSearch, setBulkPickerSearch] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [name, setName] = useState('');
  const [quantity, setQuantity] = useState('');
  const [unit, setUnit] = useState('шт');
  const [minQuantity, setMinQuantity] = useState('2');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | undefined>(undefined);
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({ ungrouped: true });
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [categoryNameInput, setCategoryNameInput] = useState('');
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortAsc, setSortAsc] = useState(true);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editName, setEditName] = useState('');
  const [editQuantity, setEditQuantity] = useState('');
  const [editUnit, setEditUnit] = useState('');
  const [editMinQuantity, setEditMinQuantity] = useState('');
  const [editCategoryId, setEditCategoryId] = useState<string | undefined>(undefined);
  const [commentsItemId, setCommentsItemId] = useState<string>('');
  const [commentsModalVisible, setCommentsModalVisible] = useState(false);
  const styles = useMemo(() => createStyles(colors), [colors]);

  const { guardEdit } = useSubscriberGuard();
  const { comments: commentsRaw, loadComments } = useComments();
  const lowStockItems = items.filter(i => isLowInventory(i.quantity, i.minQuantity));

  const inventoryCommentsMap = useMemo(() => {
    const map: Record<string, { count: number; lastText: string }> = {};
    for (const key of Object.keys(commentsRaw)) {
      if (key.startsWith('inventory:')) {
        const arr = commentsRaw[key];
        if (arr && arr.length > 0) {
          map[key] = { count: arr.length, lastText: arr[arr.length - 1].text };
        }
      }
    }
    return map;
  }, [commentsRaw]);

  React.useEffect(() => {
    items.forEach(item => {
      loadComments('inventory', item.id);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items.length]);

  const filteredItems = useMemo(() => {
    let result = items;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(i => i.name.toLowerCase().includes(q));
    }
    result = [...result].sort((a, b) => {
      const cmp = a.name.localeCompare(b.name, 'ru');
      return sortAsc ? cmp : -cmp;
    });
    return result;
  }, [items, searchQuery, sortAsc]);

  const categoryGrouped = useMemo(() => {
    const grouped: { category: InventoryCategory | null; items: InventoryItem[] }[] = [];
    categories.forEach(cat => {
      grouped.push({ category: cat, items: filteredItems.filter(i => i.categoryId === cat.id) });
    });
    grouped.push({ category: null, items: filteredItems.filter(i => !i.categoryId) });
    return grouped.filter(g => g.items.length > 0 || !searchQuery.trim());
  }, [filteredItems, categories, searchQuery]);

  const toggleCategory = useCallback((catId: string) => {
    setExpandedCategories(prev => ({ ...prev, [catId]: !prev[catId] }));
  }, []);

  const handleVoiceMaterialResult = useCallback((text: string) => {
    console.log('[VoiceMaterial] Recognized:', text);
    const parsed = parseMaterialVoice(text);
    console.log('[VoiceMaterial] Parsed:', parsed);

    if (!isAdding) setIsAdding(true);
    if (parsed.name) setName(parsed.name);
    if (parsed.quantity !== undefined) setQuantity(String(parsed.quantity));
    if (parsed.unit) setUnit(parsed.unit);


  }, [isAdding]);

  const handleVoiceEditResult = useCallback((text: string) => {
    console.log('[VoiceMaterialEdit] Recognized:', text);
    const parsed = parseMaterialVoice(text);
    console.log('[VoiceMaterialEdit] Parsed:', parsed);

    if (parsed.name) setEditName(parsed.name);
    if (parsed.quantity !== undefined) setEditQuantity(String(parsed.quantity));
    if (parsed.unit) setEditUnit(parsed.unit);


  }, []);

  const handleAdd = async () => {
    const qty = parseInt(quantity) || 0;
    const minParsed = parseInt(minQuantity, 10);
    const min = Number.isFinite(minParsed) && minParsed >= 0 ? minParsed : 2;
    if (!name.trim()) { Alert.alert('Ошибка', 'Введите название'); return; }
    const ok = await guardEdit();
    if (!ok) return;
    await addItem({ name: name.trim(), quantity: qty, unit: unit.trim() || 'шт', minQuantity: min, categoryId: selectedCategoryId });
    setName(''); setQuantity(''); setUnit('шт'); setMinQuantity('2'); setSelectedCategoryId(undefined); setIsAdding(false);
  };

  const handleUpdateQuantity = async (item: InventoryItem, delta: number) => {
    const newQty = Math.max(0, item.quantity + delta);
    await updateItem(item.id, { quantity: newQty });
  };

  const handleDelete = (id: string) => {
    Alert.alert('Удалить?', 'Это действие нельзя отменить', [
      { text: 'Отмена', style: 'cancel' },
      { text: 'Удалить', style: 'destructive', onPress: () => deleteItem(id) },
    ]);
  };

  const handleEditItem = (item: InventoryItem) => {
    setEditingItem(item);
    setEditName(item.name);
    setEditQuantity(String(item.quantity));
    setEditUnit(item.unit);
    setEditMinQuantity(String(item.minQuantity));
    setEditCategoryId(item.categoryId);
    setShowEditModal(true);
  };

  const handleSaveEdit = async () => {
    if (!editingItem || !editName.trim()) return;
    const ok = await guardEdit();
    if (!ok) return;
    await updateItem(editingItem.id, {
      name: editName.trim(),
      quantity: parseInt(editQuantity) || 0,
      unit: editUnit.trim() || 'шт',
      minQuantity: (() => { const v = parseInt(editMinQuantity, 10); return Number.isFinite(v) && v >= 0 ? v : 2; })(),
      categoryId: editCategoryId,
    });
    setShowEditModal(false);
    setEditingItem(null);
  };

  const handleAddCategory = async () => {
    if (!categoryNameInput.trim()) return;
    const ok = await guardEdit();
    if (!ok) return;
    if (editingCategoryId) {
      await updateCategory(editingCategoryId, categoryNameInput.trim());
    } else {
      const cat = await addCategory(categoryNameInput.trim());
      setExpandedCategories(prev => ({ ...prev, [cat.id]: true }));
    }
    setCategoryNameInput('');
    setEditingCategoryId(null);
    setShowCategoryModal(false);
  };

  const handleEditCategory = (cat: InventoryCategory) => {
    setEditingCategoryId(cat.id);
    setCategoryNameInput(cat.name);
    setShowCategoryModal(true);
  };

  const handleDeleteCategory = (cat: InventoryCategory) => {
    Alert.alert('Удалить категорию?', `Материалы из "${cat.name}" останутся без категории`, [
      { text: 'Отмена', style: 'cancel' },
      { text: 'Удалить', style: 'destructive', onPress: () => deleteCategory(cat.id) },
    ]);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Склад</Text>
        <NotificationBell />
      </View>

      <View style={styles.tabsRow}>
        <TouchableOpacity style={[styles.tabBtn, activeTab === 'stock' && styles.tabBtnActive]} onPress={() => setActiveTab('stock')}>
          <Package size={16} color={activeTab === 'stock' ? colors.text : colors.textSecondary} />
          <Text style={[styles.tabBtnText, activeTab === 'stock' && { color: colors.text }]}>Склад</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tabBtn, activeTab === 'history' && styles.tabBtnActive]} onPress={() => setActiveTab('history')}>
          <History size={16} color={activeTab === 'history' ? colors.text : colors.textSecondary} />
          <Text style={[styles.tabBtnText, activeTab === 'history' && { color: colors.text }]}>История</Text>
          {movements.length > 0 && (
            <Text style={{ color: colors.textMuted, fontSize: 11 }}>{movements.length}</Text>
          )}
        </TouchableOpacity>
      </View>

      {activeTab === 'stock' && (
        <View style={styles.actionRow}>
          <TouchableOpacity style={styles.smallButton} onPress={() => { setEditingCategoryId(null); setCategoryNameInput(''); setShowCategoryModal(true); }}>
            <FolderPlus size={20} color={colors.text} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.smallButton} onPress={() => { setBulkRows([]); setBulkComment(''); setShowBulkModal(true); }}>
            <PackagePlus size={20} color={colors.text} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.addButton} onPress={() => setIsAdding(true)}>
            <Plus size={24} color={colors.text} />
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.searchRow}>
        <View style={styles.searchInputWrapper}>
          <Search size={18} color={colors.textMuted} style={{ marginRight: 10 }} />
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Поиск материалов..."
            placeholderTextColor={colors.textMuted}
            style={styles.searchInput}
          />
        </View>
        <TouchableOpacity style={styles.sortButton} onPress={() => setSortAsc(!sortAsc)}>
          <Text style={{ fontSize: 12, fontWeight: '700' as const, color: colors.primary }}>{sortAsc ? 'А-Я' : 'Я-А'}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.sortButton} onPress={() => {
          const allExpanded = categoryGrouped.every(g => expandedCategories[g.category?.id || 'ungrouped'] !== false);
          const newState: Record<string, boolean> = {};
          categoryGrouped.forEach(g => { newState[g.category?.id || 'ungrouped'] = !allExpanded; });
          setExpandedCategories(newState);
        }}>
          <ChevronsUpDown size={18} color={colors.primary} />
        </TouchableOpacity>
      </View>

      {activeTab === 'stock' && lowStockItems.length > 0 && (
        <View style={styles.warningBanner}>
          <AlertTriangle size={20} color={colors.error} />
          <Text style={{ color: colors.error, fontSize: 14, fontWeight: '500' as const }}>Заканчивается: {lowStockItems.length} позиций</Text>
        </View>
      )}

      {activeTab === 'history' && movements.length > 0 && (
        <View style={{ paddingHorizontal: 16, marginBottom: 8 }}>
          <TouchableOpacity
            onPress={async () => {
              try {
                await exportInventoryHistory(movements);
              } catch (e: any) {
                Alert.alert('Ошибка', e?.message || 'Не удалось экспортировать');
              }
            }}
            style={{ flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'center' as const, gap: 8, paddingVertical: 12, borderRadius: 12, backgroundColor: colors.success + '15', borderWidth: 1, borderColor: colors.success + '40' }}
          >
            <FileSpreadsheet size={18} color={colors.success} />
            <Text style={{ color: colors.success, fontSize: 14, fontWeight: '600' as const }}>Экспорт истории в Excel</Text>
          </TouchableOpacity>
        </View>
      )}

      {activeTab === 'history' ? (
        <FlatList
          data={movements}
          keyExtractor={(m) => m.id}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 200, paddingTop: 8 }}
          renderItem={({ item }) => (
            <Card style={{ marginBottom: 10, borderLeftWidth: 4, borderLeftColor: item.type === 'in' ? colors.success : colors.warning }}>
              <View style={{ flexDirection: 'row' as const, alignItems: 'center' as const, gap: 10 }}>
                <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: (item.type === 'in' ? colors.success : colors.warning) + '20', alignItems: 'center' as const, justifyContent: 'center' as const }}>
                  {item.type === 'in' ? <ArrowDownToLine size={18} color={colors.success} /> : <ArrowUpFromLine size={18} color={colors.warning} />}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 14, fontWeight: '600' as const, color: colors.text }} numberOfLines={1}>{item.itemName}</Text>
                  <Text style={{ fontSize: 11, color: colors.textMuted, marginTop: 2 }}>{formatDateTime(item.createdAt)}</Text>
                </View>
                <Text style={{ fontSize: 16, fontWeight: '700' as const, color: item.type === 'in' ? colors.success : colors.warning }}>
                  {item.type === 'in' ? '+' : '-'}{item.quantity} {item.unit}
                </Text>
                <TouchableOpacity onPress={() => Alert.alert('Удалить запись?', '', [{ text: 'Отмена', style: 'cancel' }, { text: 'Удалить', style: 'destructive', onPress: () => deleteMovement(item.id) }])} style={{ padding: 6 }}>
                  <Trash2 size={14} color={colors.error} />
                </TouchableOpacity>
              </View>
              {(item.objectName || item.comment) && (
                <View style={{ marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: colors.border }}>
                  {item.objectName && (
                    <Text style={{ fontSize: 12, color: colors.textSecondary }}>Объект: {item.objectName}</Text>
                  )}
                  {item.comment && (
                    <Text style={{ fontSize: 12, color: colors.textMuted, marginTop: 2 }}>{item.comment}</Text>
                  )}
                </View>
              )}
            </Card>
          )}
          ListEmptyComponent={
            <View style={{ alignItems: 'center' as const, justifyContent: 'center' as const, paddingVertical: 60, gap: 16 }}>
              <History size={48} color={colors.textMuted} />
              <Text style={{ fontSize: 16, color: colors.textSecondary }}>Нет операций</Text>
              <Text style={{ fontSize: 13, color: colors.textMuted, textAlign: 'center' as const, paddingHorizontal: 32 }}>Здесь будут отображаться все приходы и списания материалов по объектам</Text>
            </View>
          }
          showsVerticalScrollIndicator={false}
        />
      ) : isLoading ? (
        <View style={styles.loadingContainer}><Text style={{ color: colors.textSecondary, fontSize: 16 }}>Загрузка...</Text></View>
      ) : (
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 80 : 0}
        >
          <FlatList
            data={categoryGrouped}
            keyExtractor={(item) => item.category?.id || 'ungrouped'}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => (
              <CategorySection
                category={item.category}
                items={item.items}
                colors={colors}
                isExpanded={expandedCategories[item.category?.id || 'ungrouped'] !== false}
                onToggle={() => toggleCategory(item.category?.id || 'ungrouped')}
                onEdit={item.category ? () => handleEditCategory(item.category!) : undefined}
                onDelete={item.category ? () => handleDeleteCategory(item.category!) : undefined}
                onUpdate={handleUpdateQuantity}
                onDeleteItem={handleDelete}
                onEditItem={handleEditItem}
                onComments={(itemId) => { setCommentsItemId(itemId); setCommentsModalVisible(true); }}
                commentsMap={inventoryCommentsMap}
              />
            )}
            ListHeaderComponent={isAdding ? (
              <Card style={{ marginBottom: 16 }}>
                <View style={{ flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'space-between' as const, marginBottom: 16 }}>
                  <Text style={{ fontSize: 18, fontWeight: '600' as const, color: colors.text }}>Новый материал</Text>
                  <VoiceInputButton onResult={handleVoiceMaterialResult} size={36} />
                </View>
                <Input label="Название" value={name} onChangeText={setName} placeholder="Например: Дымовой датчик" />
                <View style={{ flexDirection: 'row' as const }}>
                  <Input label="Кол-во" value={quantity} onChangeText={setQuantity} placeholder="0" keyboardType="numeric" containerStyle={{ flex: 1, marginRight: 8 }} />
                  <Input label="Единица" value={unit} onChangeText={setUnit} placeholder="шт" containerStyle={{ flex: 1 }} />
                </View>
                <Input label="Мин. запас" value={minQuantity} onChangeText={setMinQuantity} placeholder="2" keyboardType="numeric" />
                {categories.length > 0 && (
                  <View style={{ marginBottom: 12 }}>
                    <Text style={{ fontSize: 13, color: colors.textSecondary, marginBottom: 8 }}>Категория:</Text>
                    <View style={{ flexDirection: 'row' as const, flexWrap: 'wrap' as const, gap: 6 }}>
                      <TouchableOpacity
                        style={[styles.catChip, !selectedCategoryId && styles.catChipActive]}
                        onPress={() => setSelectedCategoryId(undefined)}
                      >
                        <Text style={[styles.catChipText, !selectedCategoryId && styles.catChipTextActive]}>Без категории</Text>
                      </TouchableOpacity>
                      {categories.map(cat => (
                        <TouchableOpacity
                          key={cat.id}
                          style={[styles.catChip, selectedCategoryId === cat.id && styles.catChipActive]}
                          onPress={() => setSelectedCategoryId(cat.id)}
                        >
                          <Text style={[styles.catChipText, selectedCategoryId === cat.id && styles.catChipTextActive]}>{cat.name}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                )}
                <View style={{ flexDirection: 'row' as const, gap: 12, marginTop: 8 }}>
                  <Button title="Отмена" variant="ghost" onPress={() => setIsAdding(false)} style={{ flex: 1 }} />
                  <Button title="Добавить" onPress={handleAdd} disabled={!name.trim()} style={{ flex: 1 }} />
                </View>
              </Card>
            ) : null}
            contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 200 }}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <View style={{ alignItems: 'center' as const, justifyContent: 'center' as const, paddingVertical: 60, gap: 16 }}>
                <Package size={48} color={colors.textMuted} />
                <Text style={{ fontSize: 16, color: colors.textSecondary }}>{searchQuery ? 'Ничего не найдено' : 'Склад пуст'}</Text>
                {!searchQuery && <Button title="Добавить материал" variant="secondary" onPress={() => setIsAdding(true)} />}
              </View>
            }
          />
        </KeyboardAvoidingView>
      )}

      <Modal visible={showCategoryModal} animationType="slide" transparent onRequestClose={() => { setShowCategoryModal(false); setEditingCategoryId(null); setCategoryNameInput(''); }}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{editingCategoryId ? 'Переименовать категорию' : 'Новая категория'}</Text>
            <TextInput
              style={styles.modalInput}
              value={categoryNameInput}
              onChangeText={setCategoryNameInput}
              placeholder="Например: Датчики"
              placeholderTextColor={colors.textMuted}
              autoFocus
            />
            <View style={{ flexDirection: 'row' as const, gap: 12 }}>
              <Button title="Отмена" variant="ghost" onPress={() => { setShowCategoryModal(false); setEditingCategoryId(null); setCategoryNameInput(''); }} style={{ flex: 1 }} />
              <Button title={editingCategoryId ? 'Сохранить' : 'Создать'} onPress={handleAddCategory} disabled={!categoryNameInput.trim()} style={{ flex: 1 }} />
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={showEditModal} animationType="slide" transparent onRequestClose={() => { setShowEditModal(false); setEditingItem(null); }}>
        <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={[styles.modalContent, { maxHeight: '85%' }]}>
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <View style={{ flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'space-between' as const, marginBottom: 16 }}>
                <Text style={[styles.modalTitle, { marginBottom: 0 }]}>Редактировать</Text>
                <VoiceInputButton onResult={handleVoiceEditResult} size={34} />
              </View>
              <TextInput
                style={styles.modalInput}
                value={editName}
                onChangeText={setEditName}
                placeholder="Название"
                placeholderTextColor={colors.textMuted}
              />
              <View style={{ flexDirection: 'row' as const, gap: 8 }}>
                <TextInput
                  style={[styles.modalInput, { flex: 1 }]}
                  value={editQuantity}
                  onChangeText={setEditQuantity}
                  placeholder="Кол-во"
                  placeholderTextColor={colors.textMuted}
                  keyboardType="numeric"
                />
                <TextInput
                  style={[styles.modalInput, { flex: 1 }]}
                  value={editUnit}
                  onChangeText={setEditUnit}
                  placeholder="Единица"
                  placeholderTextColor={colors.textMuted}
                />
              </View>
              <TextInput
                style={styles.modalInput}
                value={editMinQuantity}
                onChangeText={setEditMinQuantity}
                placeholder="Мин. запас"
                placeholderTextColor={colors.textMuted}
                keyboardType="numeric"
              />
              {categories.length > 0 && (
                <View style={{ marginBottom: 12 }}>
                  <Text style={{ fontSize: 13, color: colors.textSecondary, marginBottom: 8 }}>Категория:</Text>
                  <View style={{ flexDirection: 'row' as const, flexWrap: 'wrap' as const, gap: 6 }}>
                    <TouchableOpacity
                      style={[styles.catChip, !editCategoryId && styles.catChipActive]}
                      onPress={() => setEditCategoryId(undefined)}
                    >
                      <Text style={[styles.catChipText, !editCategoryId && styles.catChipTextActive]}>Без категории</Text>
                    </TouchableOpacity>
                    {categories.map(cat => (
                      <TouchableOpacity
                        key={cat.id}
                        style={[styles.catChip, editCategoryId === cat.id && styles.catChipActive]}
                        onPress={() => setEditCategoryId(cat.id)}
                      >
                        <Text style={[styles.catChipText, editCategoryId === cat.id && styles.catChipTextActive]}>{cat.name}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              )}
              <View style={{ flexDirection: 'row' as const, gap: 12 }}>
                <Button title="Отмена" variant="ghost" onPress={() => { setShowEditModal(false); setEditingItem(null); }} style={{ flex: 1 }} />
                <Button title="Сохранить" onPress={handleSaveEdit} disabled={!editName.trim()} style={{ flex: 1 }} />
              </View>

            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
      <Modal visible={showBulkModal} animationType="slide" transparent onRequestClose={() => setShowBulkModal(false)}>
        <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={[styles.modalContent, { maxHeight: '88%' }]}>
            <View style={{ flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'space-between' as const, marginBottom: 12 }}>
              <Text style={[styles.modalTitle, { marginBottom: 0 }]}>Массовый приход</Text>
              <Text style={{ fontSize: 12, color: colors.textMuted }}>{bulkRows.length} позиций</Text>
            </View>
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" style={{ maxHeight: 360 }}>
              {bulkRows.length === 0 && (
                <Text style={{ fontSize: 13, color: colors.textMuted, textAlign: 'center' as const, paddingVertical: 18 }}>Добавьте материалы для прихода</Text>
              )}
              {bulkRows.map((row, idx) => (
                <View key={`${row.itemId}-${idx}`} style={{ flexDirection: 'row' as const, alignItems: 'center' as const, gap: 8, marginBottom: 8, backgroundColor: colors.surface, borderRadius: 10, padding: 10, borderWidth: 1, borderColor: colors.border }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 13, color: colors.text, fontWeight: '600' as const }} numberOfLines={1}>{row.itemName}</Text>
                    <Text style={{ fontSize: 11, color: colors.textMuted, marginTop: 2 }}>{row.unit}</Text>
                  </View>
                  <TextInput
                    style={{ width: 80, backgroundColor: colors.surfaceElevated, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, color: colors.text, fontSize: 14, borderWidth: 1, borderColor: colors.border, textAlign: 'center' as const }}
                    keyboardType="numeric"
                    value={row.quantity}
                    onChangeText={(v) => setBulkRows(prev => prev.map((r, i) => i === idx ? { ...r, quantity: v } : r))}
                    placeholder="0"
                    placeholderTextColor={colors.textMuted}
                  />
                  <TouchableOpacity onPress={() => setBulkRows(prev => prev.filter((_, i) => i !== idx))} style={{ padding: 4 }}>
                    <Trash2 size={16} color={colors.error} />
                  </TouchableOpacity>
                </View>
              ))}
            </ScrollView>
            <TouchableOpacity
              style={{ flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'center' as const, gap: 6, paddingVertical: 12, borderRadius: 10, borderWidth: 1, borderStyle: 'dashed' as const, borderColor: colors.primary, marginBottom: 10, marginTop: 4 }}
              onPress={() => { setBulkPickerSearch(''); setBulkPickerVisible(true); }}
            >
              <Plus size={16} color={colors.primary} />
              <Text style={{ color: colors.primary, fontSize: 14, fontWeight: '600' as const }}>Добавить материал</Text>
            </TouchableOpacity>
            <TextInput
              style={styles.modalInput}
              value={bulkComment}
              onChangeText={setBulkComment}
              placeholder="Комментарий к приходу (необязательно)"
              placeholderTextColor={colors.textMuted}
            />
            <View style={{ flexDirection: 'row' as const, gap: 12 }}>
              <Button title="Отмена" variant="ghost" onPress={() => setShowBulkModal(false)} style={{ flex: 1 }} />
              <Button
                title="Оприходовать"
                onPress={async () => {
                  const entries: BulkReceiptItem[] = bulkRows
                    .map(r => ({ itemId: r.itemId, itemName: r.itemName, unit: r.unit, quantity: parseInt(r.quantity, 10) || 0 }))
                    .filter(e => e.quantity > 0);
                  if (entries.length === 0) { Alert.alert('Ошибка', 'Добавьте хотя бы одну позицию с количеством'); return; }
                  const ok = await guardEdit();
                  if (!ok) return;
                  await bulkReceipt(entries, bulkComment.trim() || undefined);
                  setShowBulkModal(false);
                  setBulkRows([]);
                  setBulkComment('');
                }}
                disabled={bulkRows.length === 0}
                style={{ flex: 1 }}
              />
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={bulkPickerVisible} animationType="slide" transparent onRequestClose={() => setBulkPickerVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxHeight: '80%' }]}>
            <View style={{ flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'space-between' as const, marginBottom: 12 }}>
              <Text style={[styles.modalTitle, { marginBottom: 0 }]}>Выберите материал</Text>
              <TouchableOpacity onPress={() => setBulkPickerVisible(false)}><Text style={{ color: colors.primary, fontSize: 14 }}>Готово</Text></TouchableOpacity>
            </View>
            <TextInput
              style={styles.modalInput}
              value={bulkPickerSearch}
              onChangeText={setBulkPickerSearch}
              placeholder="Поиск..."
              placeholderTextColor={colors.textMuted}
            />
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              {items
                .filter(i => !bulkPickerSearch.trim() || i.name.toLowerCase().includes(bulkPickerSearch.toLowerCase()))
                .map(i => {
                  const already = bulkRows.find(r => r.itemId === i.id);
                  return (
                    <TouchableOpacity
                      key={i.id}
                      onPress={() => {
                        if (already) return;
                        setBulkRows(prev => [...prev, { itemId: i.id, itemName: i.name, unit: i.unit, quantity: '1' }]);
                      }}
                      style={{ flexDirection: 'row' as const, alignItems: 'center' as const, gap: 10, paddingVertical: 12, paddingHorizontal: 8, borderRadius: 8, marginBottom: 4, backgroundColor: already ? colors.primary + '15' : 'transparent' }}
                    >
                      <Package size={16} color={already ? colors.primary : colors.secondary} />
                      <Text style={{ flex: 1, color: colors.text, fontSize: 14 }}>{i.name}</Text>
                      <Text style={{ color: colors.textMuted, fontSize: 12 }}>{i.quantity} {i.unit}</Text>
                      {already && <Text style={{ color: colors.primary, fontSize: 11, fontWeight: '700' as const }}>✓</Text>}
                    </TouchableOpacity>
                  );
                })}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <CommentsBottomSheet
        visible={commentsModalVisible}
        onClose={() => setCommentsModalVisible(false)}
        entityType="inventory"
        entityId={commentsItemId}
        title="Комментарии к материалу"
      />
    </SafeAreaView>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12 },
    tabsRow: { flexDirection: 'row', paddingHorizontal: 16, gap: 8, marginBottom: 8 },
    tabBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: 12, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
    tabBtnActive: { backgroundColor: colors.surfaceElevated, borderColor: colors.primary },
    tabBtnText: { fontSize: 13, fontWeight: '600' as const, color: colors.textSecondary },
    actionRow: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', paddingHorizontal: 16, marginBottom: 8, gap: 8 },
    title: { fontSize: 28, fontWeight: 'bold', color: colors.text },
    smallButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surfaceElevated, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border },
    addButton: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
    searchRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, marginBottom: 12, gap: 8 },
    searchInputWrapper: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surfaceElevated, borderRadius: 12, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 14 },
    searchInput: { flex: 1, color: colors.text, fontSize: 16, paddingVertical: 12 },
    sortButton: { width: 44, height: 44, borderRadius: 12, backgroundColor: colors.surfaceElevated, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border },
    warningBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.error + '20', marginHorizontal: 16, marginBottom: 16, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: colors.error },
    loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    catChip: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 16, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
    catChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
    catChipText: { color: colors.textSecondary, fontSize: 12, fontWeight: '500' as const },
    catChipTextActive: { color: colors.text },
    modalOverlay: { flex: 1, backgroundColor: colors.overlay, justifyContent: 'center', alignItems: 'center', padding: 24 },
    modalContent: { width: '100%', backgroundColor: colors.surfaceElevated, borderRadius: 16, padding: 20 },
    modalTitle: { fontSize: 18, fontWeight: '600' as const, color: colors.text, marginBottom: 16 },
    modalInput: { backgroundColor: colors.surface, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, color: colors.text, fontSize: 16, borderWidth: 1, borderColor: colors.border, marginBottom: 16 },
  });
}
