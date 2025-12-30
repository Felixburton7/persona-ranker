import { Database, Search, Cpu, Zap } from "lucide-react";

export function OptimizationWorkflow() {
    return (
        <div className="mb-24">
            <div className="flex flex-col md:flex-row gap-4 items-stretch md:items-center justify-between border-y border-[#E5E5E5] py-12 relative">
                {/* Background Grid Pattern */}
                <div className="absolute inset-0 opacity-[0.03] pointer-events-none"
                    style={{ backgroundImage: 'radial-gradient(#000 1px, transparent 1px)', backgroundSize: '24px 24px' }}
                />

                {/* Step 1: Evaluate */}
                <div className="flex-1 relative group">
                    <div className="absolute top-0 left-0 w-full h-full bg-[#F9F8F4] -z-10" />
                    <div className="space-y-3 p-4 border border-transparent hover:border-[#E5E5E5] hover:bg-white transition-all rounded-lg">
                        <div className="w-10 h-10 bg-[#E5E5E5] rounded-lg flex items-center justify-center mb-2 group-hover:bg-[#121212] group-hover:text-white transition-colors">
                            <Database size={20} />
                        </div>
                        <h3 className="font-bold text-lg">Evaluate</h3>
                        <p className="text-sm text-[#78716c]">Run current prompt on 50 test leads</p>
                    </div>
                    <div className="hidden md:block absolute top-[28px] -right-4 w-8 h-[2px] bg-[#E5E5E5]" />
                </div>

                {/* Step 2: Analyze */}
                <div className="flex-1 relative group">
                    <div className="space-y-3 p-4 border border-transparent hover:border-[#E5E5E5] hover:bg-white transition-all rounded-lg">
                        <div className="w-10 h-10 bg-[#E5E5E5] rounded-lg flex items-center justify-center mb-2 group-hover:bg-[#121212] group-hover:text-white transition-colors">
                            <Search size={20} />
                        </div>
                        <h3 className="font-bold text-lg">Analyze Errors</h3>
                        <p className="text-sm text-[#78716c]">Find false positives & negatives</p>
                    </div>
                    <div className="hidden md:block absolute top-[28px] -right-4 w-8 h-[2px] bg-[#E5E5E5]" />
                </div>

                {/* Step 3: Generate */}
                <div className="flex-1 relative group">
                    <div className="space-y-3 p-4 border border-transparent hover:border-[#E5E5E5] hover:bg-white transition-all rounded-lg">
                        <div className="w-10 h-10 bg-[#E5E5E5] rounded-lg flex items-center justify-center mb-2 group-hover:bg-[#121212] group-hover:text-white transition-colors">
                            <Cpu size={20} />
                        </div>
                        <h3 className="font-bold text-lg">Generate Fixes</h3>
                        <p className="text-sm text-[#78716c]">AI suggests prompt improvements</p>
                    </div>
                    <div className="hidden md:block absolute top-[28px] -right-4 w-8 h-[2px] bg-[#E5E5E5]" />
                </div>

                {/* Step 4: Apply */}
                <div className="flex-1 relative group">
                    <div className="space-y-3 p-4 border border-transparent hover:border-[#E5E5E5] hover:bg-white transition-all rounded-lg">
                        <div className="w-10 h-10 bg-[#E5E5E5] rounded-lg flex items-center justify-center mb-2 group-hover:bg-[#121212] group-hover:text-white transition-colors">
                            <Zap size={20} />
                        </div>
                        <h3 className="font-bold text-lg">Apply & Repeat</h3>
                        <p className="text-sm text-[#78716c]">Update prompt, iterate until optimal</p>
                    </div>
                </div>
            </div>
        </div>
    );
}
