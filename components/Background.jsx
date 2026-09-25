const Background = () => {
    return (
        <div className="fixed inset-0 w-full h-full overflow-hidden -z-50 bg-[#020617]">
            {/* Gradient Orb 1 */}
            <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-primary-gold/10 blur-[120px] animate-blob"></div>

            {/* Gradient Orb 2 */}
            <div className="absolute top-[20%] right-[-10%] w-[40%] h-[40%] rounded-full bg-blue-600/10 blur-[120px] animate-blob animation-delay-2000"></div>

            {/* Gradient Orb 3 */}
            <div className="absolute bottom-[-10%] left-[20%] w-[50%] h-[50%] rounded-full bg-purple-600/10 blur-[120px] animate-blob animation-delay-4000"></div>

            {/* Mesh Grid Overlay (Optional for texture) */}
            <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-[0.02]"></div>
        </div>
    );
};

export default Background;
