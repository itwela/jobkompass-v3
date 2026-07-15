import { ApprovalQueue } from "@/app/jk-components/jkEmailLeads/ApprovalQueue";
import { LeadsList } from "@/app/jk-components/jkEmailLeads/LeadsList";
import { ScanNowButton } from "@/app/jk-components/jkEmailLeads/ScanNowButton";

export default function LeadsPage() {
  return (
    <div className="p-6 space-y-8">
      <section>
        <h2 className="text-lg font-semibold mb-4">Pending Approval</h2>
        <ApprovalQueue />
      </section>
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">All Leads</h2>
          <ScanNowButton />
        </div>
        <LeadsList />
      </section>
    </div>
  );
}
