import { router, useFocusEffect } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import { useCallback, useRef, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { loadFarmIdentity, type FarmIdentity } from "@/src/application/appSnapshot";
import {
  LocalBankMovementRepository,
  type BankMovementCursor,
  type BankMovementPage
} from "@/src/application/localBankMovementRepository";
import { bankMovementLabel, type BankMovement } from "@/src/domain/bankMovement";
import { formatTry } from "@/src/domain/money";
import { mobileDatabase } from "@/src/mobile/database";
import { dateInputFromIso } from "@/src/mobile/date";
import { BigButton, Card, ErrorNote, PageTitle, Screen, SecondaryButton, SectionTitle } from "@/src/ui/components";
import { uxPolicy } from "@/src/ui/policy";
import { theme } from "@/src/ui/theme";

const PAGE_SIZE = 20;

export default function BankMovementsScreen() {
  const sqlite = useSQLiteContext();
  const [identity, setIdentity] = useState<FarmIdentity | null>(null);
  const [items, setItems] = useState<readonly BankMovement[]>([]);
  const [nextCursor, setNextCursor] = useState<BankMovementCursor>();
  const [canGoNewer, setCanGoNewer] = useState(false);
  const [loading, setLoading] = useState(true);
  const [paging, setPaging] = useState(false);
  const [error, setError] = useState<string>();
  const [lastDeleted, setLastDeleted] = useState<BankMovement | null>(null);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const currentStartRef = useRef<BankMovementCursor>();
  const newerStartsRef = useRef<Array<BankMovementCursor | undefined>>([]);

  const readPage = useCallback(async (
    farmId: string,
    cursor: BankMovementCursor | undefined
  ): Promise<BankMovementPage> => {
    const repository = new LocalBankMovementRepository(mobileDatabase(sqlite));
    return cursor === undefined
      ? await repository.page({ farmId, limit: PAGE_SIZE })
      : await repository.page({ farmId, cursor, limit: PAGE_SIZE });
  }, [sqlite]);

  const applyPage = (page: BankMovementPage) => {
    setItems(page.items);
    setNextCursor(page.nextCursor);
  };

  const loadFresh = useCallback(async () => {
    setLoading(true);
    setError(undefined);
    try {
      const loadedIdentity = await loadFarmIdentity(mobileDatabase(sqlite));
      if (loadedIdentity === null) {
        setIdentity(null);
        setItems([]);
        setNextCursor(undefined);
        currentStartRef.current = undefined;
        newerStartsRef.current = [];
        setCanGoNewer(false);
        router.replace("/onboarding");
        return;
      }
      currentStartRef.current = undefined;
      newerStartsRef.current = [];
      setCanGoNewer(false);
      setIdentity(loadedIdentity);
      applyPage(await readPage(loadedIdentity.farmId, undefined));
    } catch {
      setError("Banka hareketlerini şu an açamadık. Kayıtların silinmedi.");
    } finally {
      setLoading(false);
    }
  }, [readPage, sqlite]);

  useFocusEffect(useCallback(() => {
    void loadFresh();
  }, [loadFresh]));

  const showOlder = async () => {
    if (identity === null || nextCursor === undefined || paging || busyRef.current) return;
    const previousStart = currentStartRef.current;
    newerStartsRef.current.push(previousStart);
    currentStartRef.current = nextCursor;
    setCanGoNewer(true);
    setPaging(true);
    setError(undefined);
    try {
      applyPage(await readPage(identity.farmId, nextCursor));
    } catch {
      newerStartsRef.current.pop();
      currentStartRef.current = previousStart;
      setCanGoNewer(newerStartsRef.current.length > 0);
      setError("Daha eski banka hareketlerini açamadık. Tekrar deneyebilirsin.");
    } finally {
      setPaging(false);
    }
  };

  const showNewer = async () => {
    if (identity === null || newerStartsRef.current.length === 0 || paging || busyRef.current) return;
    const currentStart = currentStartRef.current;
    const previousStart = newerStartsRef.current.pop();
    currentStartRef.current = previousStart;
    setCanGoNewer(newerStartsRef.current.length > 0);
    setPaging(true);
    setError(undefined);
    try {
      applyPage(await readPage(identity.farmId, previousStart));
    } catch {
      newerStartsRef.current.push(previousStart);
      currentStartRef.current = currentStart;
      setCanGoNewer(true);
      setError("Daha yeni banka hareketlerini açamadık. Tekrar deneyebilirsin.");
    } finally {
      setPaging(false);
    }
  };

  const deleteMovement = async (item: BankMovement) => {
    if (identity === null || busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setError(undefined);
    try {
      const deleted = await new LocalBankMovementRepository(mobileDatabase(sqlite)).softDelete({
        farmId: identity.farmId,
        movementId: item.id,
        nowIso: new Date().toISOString()
      });
      if (!deleted) {
        setError("Bu banka hareketi zaten silinmiş veya bulunamadı.");
        return;
      }
      setLastDeleted(item);
      applyPage(await readPage(identity.farmId, currentStartRef.current));
    } catch {
      setError("Banka hareketini silemedik. Diğer kayıtların güvende.");
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  const askDelete = (item: BankMovement) => {
    if (busyRef.current || paging) return;
    Alert.alert(
      "Bu banka hareketi silinsin mi?",
      `${bankMovementLabel(item.kind)} · ${formatTry(item.amountKurus)}`,
      [
        { text: "Vazgeç", style: "cancel" },
        { text: "Sil", style: "destructive", onPress: () => void deleteMovement(item) }
      ]
    );
  };

  const restoreLastDeleted = async () => {
    if (identity === null || lastDeleted === null || busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setError(undefined);
    try {
      const restored = await new LocalBankMovementRepository(mobileDatabase(sqlite)).restore({
        farmId: identity.farmId,
        movementId: lastDeleted.id,
        nowIso: new Date().toISOString()
      });
      if (!restored) {
        setLastDeleted(null);
        setError("Bu banka hareketini geri alamadık. Listeyi yenileyip tekrar deneyebilirsin.");
        return;
      }
      setLastDeleted(null);
      await loadFresh();
    } catch {
      setError("Banka hareketini geri alamadık. Diğer kayıtların güvende.");
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  const navigationBusy = busy || paging;

  return (
    <Screen>
      <PageTitle hint="Bankadan çektiğin ve bankaya yatırdığın parayı gör.">Banka hareketleri</PageTitle>

      <Card tone="soft">
        <Text style={styles.infoTitle}>Burada banka bakiyesi tahmin etmiyoruz</Text>
        <Text style={styles.infoText}>
          Yalnız senin kaydettiğin hareketleri gösteriyoruz. Bu kayıtlar kâr-zarar hesabını değiştirmez.
        </Text>
      </Card>

      <BigButton label="Banka hareketi ekle" icon="+" disabled={navigationBusy} onPress={() => router.push("/bank-movement-new")} />

      {lastDeleted !== null ? (
        <View style={styles.undo}>
          <View style={styles.undoCopy}>
            <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={styles.undoTitle}>Hareket silindi</Text>
            <Text style={styles.muted}>{bankMovementLabel(lastDeleted.kind)} · {formatTry(lastDeleted.amountKurus)}</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Silinen banka hareketini geri al"
            disabled={navigationBusy}
            onPress={() => void restoreLastDeleted()}
            style={styles.undoButton}
          >
            <Text style={styles.undoButtonText}>{busy ? "Alınıyor…" : "Geri al"}</Text>
          </Pressable>
        </View>
      ) : null}

      {canGoNewer ? (
        <SecondaryButton label={paging ? "Açılıyor…" : "Daha yeni hareketler"} disabled={navigationBusy} onPress={() => void showNewer()} />
      ) : null}

      {!loading ? <SectionTitle detail={`${items.length} kayıt`}>Hareketlerin</SectionTitle> : null}
      {loading && items.length === 0 ? <Text style={styles.muted}>Banka hareketleri hazırlanıyor…</Text> : null}

      {!loading && items.length === 0 && !error ? (
        <Card tone="soft">
          <Text style={styles.emptyTitle}>Henüz banka hareketi yok</Text>
          <Text style={styles.muted}>Bankadan para çektiğinde veya bankaya para yatırdığında buraya ekleyebilirsin.</Text>
        </Card>
      ) : null}

      {items.length > 0 ? (
        <View style={styles.list}>
          {items.map((item, index) => (
            <View key={item.id} style={[styles.row, index > 0 && styles.divider]}>
              <View style={styles.copy}>
                <Text style={styles.kind}>{bankMovementLabel(item.kind)}</Text>
                <Text style={styles.meta}>
                  {dateInputFromIso(item.occurredOn)}{item.bankName ? ` · ${item.bankName}` : ""}
                </Text>
                {item.note ? <Text numberOfLines={2} style={styles.note}>{item.note}</Text> : null}
              </View>
              <View style={styles.amountBlock}>
                <Text style={styles.amount}>{formatTry(item.amountKurus)}</Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`${bankMovementLabel(item.kind)} kaydını sil`}
                  disabled={navigationBusy}
                  onPress={() => askDelete(item)}
                  style={styles.deleteButton}
                >
                  <Text style={styles.deleteText}>Sil</Text>
                </Pressable>
              </View>
            </View>
          ))}
        </View>
      ) : null}

      {nextCursor !== undefined ? (
        <SecondaryButton label={paging ? "Açılıyor…" : "Daha eski hareketler"} disabled={navigationBusy} onPress={() => void showOlder()} />
      ) : null}

      <ErrorNote message={error} />
      <SecondaryButton label="Daha'ya dön" disabled={navigationBusy} onPress={() => router.replace("/more")} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  infoTitle: { color: theme.color.text, fontSize: 16, fontWeight: "900" },
  infoText: { color: theme.color.textMuted, fontSize: 13, fontWeight: "600", lineHeight: 19 },
  muted: { color: theme.color.textMuted, fontSize: 14, fontWeight: "600", lineHeight: 20 },
  undo: {
    minHeight: 64,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 9,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: theme.color.divider
  },
  undoCopy: { flex: 1, gap: 2 },
  undoTitle: { color: theme.color.text, fontSize: 15, fontWeight: "800" },
  undoButton: { minWidth: 72, minHeight: uxPolicy.minimumTouchTargetPx, alignItems: "center", justifyContent: "center" },
  undoButtonText: { color: theme.color.primary, fontSize: 14, fontWeight: "800" },
  emptyTitle: { color: theme.color.text, fontSize: 18, fontWeight: "900" },
  list: { borderTopWidth: 1, borderBottomWidth: 1, borderColor: theme.color.divider },
  row: { minHeight: 86, flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12 },
  divider: { borderTopWidth: 1, borderTopColor: theme.color.divider },
  copy: { flex: 1, gap: 3 },
  kind: { color: theme.color.text, fontSize: 16, fontWeight: "900" },
  meta: { color: theme.color.textMuted, fontSize: 13, fontWeight: "700" },
  note: { color: theme.color.textMuted, fontSize: 13, fontWeight: "600", lineHeight: 18 },
  amountBlock: { alignItems: "flex-end", gap: 4 },
  amount: { color: theme.color.text, fontSize: 16, fontWeight: "900" },
  deleteButton: { minWidth: 54, minHeight: uxPolicy.minimumTouchTargetPx, alignItems: "center", justifyContent: "center" },
  deleteText: { color: theme.color.expense, fontSize: 13, fontWeight: "800" }
});
