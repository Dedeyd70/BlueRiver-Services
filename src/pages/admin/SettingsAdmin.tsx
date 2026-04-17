import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import GeneralSettings from "@/components/admin/GeneralSettings";
import AvailabilitySettings from "@/components/admin/AvailabilitySettings";
import PaymentSettings from "@/components/admin/PaymentSettings";
import PricingSettings from "@/components/admin/PricingSettings";

const SettingsAdmin = () => {
  return (
    <div>
      <h1 className="text-2xl font-display font-bold text-foreground mb-6">Settings</h1>
      <Tabs defaultValue="general" className="space-y-4">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="availability">Availability</TabsTrigger>
          <TabsTrigger value="payment">Payment</TabsTrigger>
          <TabsTrigger value="pricing">Pricing</TabsTrigger>
        </TabsList>
        <TabsContent value="general"><GeneralSettings /></TabsContent>
        <TabsContent value="availability"><AvailabilitySettings /></TabsContent>
        <TabsContent value="payment"><PaymentSettings /></TabsContent>
        <TabsContent value="pricing"><PricingSettings /></TabsContent>
      </Tabs>
    </div>
  );
};

export default SettingsAdmin;
