import { router } from "expo-router";
import { ChoiceCard, PageTitle, Screen, SecondaryButton } from "@/src/ui/components";

export default function MoreScreen() {
  return (
    <Screen>
      <PageTitle hint="Günlük defteri kalabalıklaştırmadan diğer hesaplarını burada aç.">
        Daha
      </PageTitle>

      <ChoiceCard
        label="Borçlar"
        caption="Ne kadar borcun kaldığını ve sıradaki ödemenin tarihini gör."
        onPress={() => router.push("/debts")}
      />

      <ChoiceCard
        label="Banka hareketleri"
        caption="Bankadan çektiğin ve bankaya yatırdığın parayı ayrı takip et."
        onPress={() => router.push("/bank-movements")}
      />

      <ChoiceCard
        label="Elindekiler"
        caption="Ürün, gübre ve diğer girdilerden elinde ne kadar kaldığını gör."
        onPress={() => router.push("/inventory")}
      />

      <SecondaryButton label="Deftere dön" onPress={() => router.replace("/home")} />
    </Screen>
  );
}
