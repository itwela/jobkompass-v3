import { ApprovalQueue } from "@/app/jk-components/jkEmailLeads/ApprovalQueue";
import { LeadsList } from "@/app/jk-components/jkEmailLeads/LeadsList";

export default function LeadsPage() {
  return (
    <div className="p-6 space-y-8">
      <section>
        <h2 className="text-lg font-semibold mb-4">Pending Approval</h2>
        <ApprovalQueue />
      </section>
      <section>
        <h2 className="text-lg font-semibold mb-4">All Leads</h2>
        <LeadsList />
      </section>
    </div>
  );
}
