import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import BusinessInfoSettings from "@/components/admin/BusinessInfoSettings";
import BusinessRulesSettings from "@/components/admin/BusinessRulesSettings";
import AvailabilitySettings from "@/components/admin/AvailabilitySettings";
import PaymentSettings from "@/components/admin/PaymentSettings";
import PricingSettings from "@/components/admin/PricingSettings";
import PricingMultipliersSettings from "@/components/admin/PricingMultipliersSettings";
import SocialLinksSettings from "@/components/admin/SocialLinksSettings";
import ContentManagementSettings from "@/components/admin/ContentManagementSettings";
import ServiceAreasSettings from "@/components/admin/ServiceAreasSettings";
import TeamManagementSettings from "@/components/admin/TeamManagementSettings";
import { useHasPermission } from "@/hooks/usePermissions";
import { useAuth } from "@/hooks/useAuth";

const SettingsAdmin = () => {
  const { role } = useAuth();
  const canManageSettings = useHasPermission("can_manage_settings");
  const canManageBusinessRules = useHasPermission("can_manage_business_rules");
  const canEditAvailability = useHasPermission("can_edit_availability");
  const canManagePayment = useHasPermission("can_manage_payment");
  const canEditPricing = useHasPermission("can_edit_pricing");
  const canManageSocials = useHasPermission("can_manage_socials");

  const tabs = [
    { value: "business-info", label: "Business Info", allowed: canManageSettings, content: <BusinessInfoSettings /> },
    { value: "business-rules", label: "Business Rules", allowed: canManageBusinessRules, content: <BusinessRulesSettings /> },
    { value: "availability", label: "Availability", allowed: canEditAvailability, content: <AvailabilitySettings /> },
    { value: "payment", label: "Payment", allowed: canManagePayment, content: <PaymentSettings /> },
    { value: "pricing", label: "Pricing", allowed: canEditPricing, content: <PricingSettings /> },
    { value: "multipliers", label: "Pricing Multipliers", allowed: canEditPricing, content: <PricingMultipliersSettings /> },
    { value: "socials", label: "Social Media", allowed: canManageSocials, content: <SocialLinksSettings /> },
    { value: "content", label: "Content Management", allowed: canManageSettings, content: <ContentManagementSettings /> },
    { value: "areas", label: "Service Areas", allowed: canManageSettings, content: <ServiceAreasSettings /> },
  ].filter((t) => t.allowed);

  return (
    <div>
      <h1 className="text-2xl font-display font-bold text-foreground mb-6">Settings</h1>
      {tabs.length === 0 ? (
        <p className="text-muted-foreground text-sm">You don't have permission to manage any settings.</p>
      ) : (
        <Tabs defaultValue={tabs[0].value} className="space-y-4">
          <TabsList className="flex-wrap h-auto">
            {tabs.map((t) => (
              <TabsTrigger key={t.value} value={t.value}>{t.label}</TabsTrigger>
            ))}
          </TabsList>
          {tabs.map((t) => (
            <TabsContent key={t.value} value={t.value}>{t.content}</TabsContent>
          ))}
        </Tabs>
      )}
    </div>
  );
};

export default SettingsAdmin;
