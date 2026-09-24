import { useState, useEffect } from 'react';
import { useLanguage } from '../../context/LanguageContext';
import { translations } from '../../utils/translations';
import { useScrollAnimation } from '../../hooks/useScrollAnimation';

// Import blog images
import blogJewellery from '../../assets/blog/blog_jewellery.png';
import blogGold from '../../assets/blog/blog_gold.png';
import blogHalkhata from '../../assets/blog/blog_halkhata.png';

const BlogSection = () => {
    const [posts, setPosts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedPost, setSelectedPost] = useState(null);
    const { language } = useLanguage();
    const t = translations[language].blog;
    useScrollAnimation([loading]);

    useEffect(() => {
        // Simulate API call
        const timer = setTimeout(() => {
            setPosts([
                {
                    id: 1,
                    date: "Oct 15, 2023",
                    image: blogJewellery,
                    title: {
                        EN: "The Future of Jewellery Management in Bangladesh",
                        BN: "বাংলাদেশে জুয়েলারি ম্যানেজমেন্টের ভবিষ্যৎ"
                    },
                    excerpt: {
                        EN: "Discover how digital solutions are transforming traditional jewellery businesses across the country.",
                        BN: "জানুন কিভাবে ডিজিটাল সমাধানগুলি সারা দেশে ঐতিহ্যবাহী জুয়েলারি ব্যবসাগুলিকে পরিবর্তন করছে।"
                    },
                    content: {
                        EN: "In the rapidly evolving landscape of Bangladesh's jewellery industry, digital transformation is no longer a luxury but a necessity. Traditional methods of bookkeeping, known as 'Halkhata', are being replaced by sophisticated software solutions like Gold Rush. These tools offer precision in calculations (Vori, Ana, Roti, Point), real-time inventory tracking, and automated customer management. By adopting these technologies, jewellers can reduce errors, prevent fraud, and gain valuable insights into their business performance, ensuring sustainability and growth in a competitive market.",
                        BN: "বাংলাদেশের জুয়েলারি শিল্পের দ্রুত পরিবর্তনশীল প্রেক্ষাপটে, ডিজিটাল রূপান্তর এখন আর বিলাসিতা নয় বরং একটি প্রয়োজনীয়তা। হিসাবরক্ষণের ঐতিহ্যবাহী পদ্ধতি, যা 'হালখাতা' নামে পরিচিত, গোল্ড রাশের মতো অত্যাধুনিক সফটওয়্যার সমাধান দ্বারা প্রতিস্থাপিত হচ্ছে। এই টুলগুলো ভরি, আনা, রতি, পয়েন্টের হিসাবে নির্ভুলতা, রিয়েল-টাইম ইনভেন্টরি ট্র্যাকিং এবং স্বয়ংক্রিয় কাস্টমার ম্যানেজমেন্ট সুবিধা প্রদান করে। এই প্রযুক্তিগুলো গ্রহণ করে, জুয়েলাররা ভুল কমাতে পারে, প্রতারণা রোধ করতে পারে এবং তাদের ব্যবসায়িক পারফরম্যান্স সম্পর্কে মূল্যবান অন্তর্দৃষ্টি লাভ করতে পারে, যা একটি প্রতিযোগিতামূলক বাজারে স্থায়িত্ব এবং বৃদ্ধি নিশ্চিত করে।"
                    }
                },
                {
                    id: 2,
                    date: "Oct 10, 2023",
                    image: blogGold,
                    title: {
                        EN: "Understanding Gold Purity Standards",
                        BN: "স্বর্ণের বিশুদ্ধতার মানদণ্ড বোঝা"
                    },
                    excerpt: {
                        EN: "A comprehensive guide to understanding different gold standards and how to maintain quality control.",
                        BN: "বিভিন্ন স্বর্ণের মানদণ্ড বোঝা এবং কীভাবে গুণমান নিয়ন্ত্রণ বজায় রাখা যায় তার একটি বিশদ নির্দেশিকা।"
                    },
                    content: {
                        EN: "Gold purity is the most critical aspect of the jewellery business. Understanding the difference between 24K, 22K, 21K, and 18K gold is essential for both jewellers and customers. 24K gold is 99.9% pure but too soft for jewellery making, while 22K is the standard for high-quality ornaments. Gold Rush helps you manage these standards effortlessly, allowing you to categorize inventory based on purity, calculate prices dynamically based on daily market rates, and generate accurate invoices that build trust with your customers.",
                        BN: "স্বর্ণের বিশুদ্ধতা জুয়েলারি ব্যবসার সবচেয়ে গুরুত্বপূর্ণ দিক। ২৪ ক্যারেট, ২২ ক্যারেট, ২১ ক্যারেট এবং ১৮ ক্যারেট স্বর্ণের মধ্যে পার্থক্য বোঝা জুয়েলার এবং গ্রাহক উভয়ের জন্যই অপরিহার্য। ২৪ ক্যারেট স্বর্ণ ৯৯.৯% বিশুদ্ধ কিন্তু গয়না তৈরির জন্য খুব নরম, যেখানে ২২ ক্যারেট উচ্চমানের গয়নার জন্য মানদণ্ড। গোল্ড রাশ আপনাকে এই মানদণ্ডগুলো অনায়াসে পরিচালনা করতে সাহায্য করে, যা আপনাকে বিশুদ্ধতার ভিত্তিতে ইনভেন্টরি শ্রেণীবদ্ধ করতে, দৈনিক বাজার দরের উপর ভিত্তি করে গতিশীলভাবে দাম নির্ধারণ করতে এবং নির্ভুল ইনভয়েস তৈরি করতে দেয় যা আপনার গ্রাহকদের সাথে বিশ্বাস গড়ে তোলে।"
                    }
                },
                {
                    id: 3,
                    date: "Oct 05, 2023",
                    image: blogHalkhata,
                    title: {
                        EN: "Digital Halkhata: Modernizing Tradition",
                        BN: "ডিজিটাল হালখাতা: ঐতিহ্যের আধুনিকায়ন"
                    },
                    excerpt: {
                        EN: "How to transition from paper-based Halkhata to a secure digital ledger system while keeping traditions alive.",
                        BN: "ঐতিহ্য বজায় রেখে কীভাবে কাগজ-ভিত্তিক হালখাতা থেকে একটি নিরাপদ ডিজিটাল লেজার সিস্টেমে রূপান্তর করা যায়।"
                    },
                    content: {
                        EN: "Halkhata is an integral part of Bengali business culture, symbolizing a fresh start and the strengthening of relationships with customers. However, paper-based ledgers are prone to damage, loss, and errors. Digital Halkhata preserves the essence of this tradition while adding security and efficiency. With Gold Rush, you can send automated SMS reminders for dues, track payment history, and manage your Halkhata event seamlessly. It's the perfect blend of tradition and technology.",
                        BN: "হালখাতা বাঙালি ব্যবসায়িক সংস্কৃতির একটি অবিচ্ছেদ্য অংশ, যা একটি নতুন শুরু এবং গ্রাহকদের সাথে সম্পর্ক জোরদার করার প্রতীক। তবে, কাগজ-ভিত্তিক লেজারগুলো ক্ষতি, হারানো এবং ভুলের ঝুঁকিতে থাকে। ডিজিটাল হালখাতা নিরাপত্তা এবং দক্ষতা যোগ করার পাশাপাশি এই ঐতিহ্যের সারাংশ রক্ষা করে। গোল্ড রাশের মাধ্যমে, আপনি বকেয়ার জন্য স্বয়ংক্রিয় এসএমএস রিমাইন্ডার পাঠাতে পারেন, পেমেন্ট ইতিহাস ট্র্যাক করতে পারেন এবং আপনার হালখাতা ইভেন্টটি নির্বিঘ্নে পরিচালনা করতে পারেন। এটি ঐতিহ্য এবং প্রযুক্তির নিখুঁত সংমিশ্রণ।"
                    }
                }
            ]);
            setLoading(false);
        }, 1500);

        return () => clearTimeout(timer);
    }, []);

    return (
        <section id="blog" className="py-24 bg-darker-bg relative overflow-hidden">
            {/* Background Decoration */}
            <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
                <div className="absolute top-20 right-0 w-96 h-96 bg-primary-gold/5 rounded-full blur-3xl"></div>
                <div className="absolute bottom-20 left-0 w-96 h-96 bg-blue-500/5 rounded-full blur-3xl"></div>
            </div>

            <div className="container mx-auto px-8 relative z-10">
                <h2 className="section-title reveal">{t.title}</h2>
                <p className="section-subtitle reveal">{t.subtitle}</p>

                {loading ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                        {[1, 2, 3].map(i => (
                            <div key={i} className="bg-[#1A1D21] rounded-2xl overflow-hidden border border-white/5 animate-pulse">
                                <div className="h-48 bg-white/5"></div>
                                <div className="p-6">
                                    <div className="h-4 w-24 bg-white/5 rounded mb-4"></div>
                                    <div className="h-6 w-3/4 bg-white/5 rounded mb-4"></div>
                                    <div className="h-4 w-full bg-white/5 rounded mb-2"></div>
                                    <div className="h-4 w-2/3 bg-white/5 rounded"></div>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                        {posts.map((post, index) => (
                            <div
                                key={post.id}
                                onClick={() => setSelectedPost(post)}
                                className="group bg-[#1A1D21] rounded-2xl overflow-hidden border border-white/5 hover:border-primary-gold/30 transition-all duration-300 hover:-translate-y-2 hover:shadow-xl hover:shadow-primary-gold/5 reveal cursor-pointer"
                                style={{ transitionDelay: `${index * 0.1}s` }}
                            >
                                <div className="h-48 overflow-hidden relative">
                                    <img
                                        src={post.image}
                                        alt={post.title.EN}
                                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                                    />
                                    <div className="absolute inset-0 bg-gradient-to-t from-[#1A1D21] to-transparent opacity-60"></div>
                                </div>
                                <div className="p-6">
                                    <div className="text-xs font-medium text-primary-gold mb-3 flex items-center gap-2">
                                        <span className="w-1.5 h-1.5 rounded-full bg-primary-gold"></span>
                                        {post.date}
                                    </div>
                                    <h3 className="mb-3 text-xl font-bold text-white group-hover:text-primary-gold transition-colors line-clamp-2">
                                        {post.title[language] || post.title.EN}
                                    </h3>
                                    <p className="text-gray-400 text-sm mb-6 line-clamp-3 leading-relaxed">
                                        {post.excerpt[language] || post.excerpt.EN}
                                    </p>
                                    <div className="inline-flex items-center gap-2 text-sm font-semibold text-white group-hover:text-primary-gold transition-all group-hover:gap-3">
                                        {t.readMore}
                                        <span>→</span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Blog Modal */}
            {selectedPost && (
                <div className="modal-overlay">
                    <div className="absolute inset-0" onClick={() => setSelectedPost(null)}></div>
                    <div className="modal-container max-w-3xl p-0 flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
                        <button
                            onClick={() => setSelectedPost(null)}
                            className="absolute top-4 right-4 z-20 w-10 h-10 rounded-full bg-black/50 hover:bg-black/70 flex items-center justify-center text-white transition-colors backdrop-blur-md"
                        >
                            ✕
                        </button>

                        <div className="h-64 relative flex-shrink-0">
                            <img
                                src={selectedPost.image}
                                alt={selectedPost.title.EN}
                                className="w-full h-full object-cover"
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-[#121418] via-transparent to-transparent"></div>
                        </div>

                        <div className="p-8 md:p-10 -mt-10 relative overflow-y-auto custom-scrollbar">
                            <div className="flex items-center gap-3 mb-6">
                                <span className="px-3 py-1 bg-primary-gold/10 text-primary-gold text-xs font-bold rounded-full border border-primary-gold/20 backdrop-blur-md">
                                    {selectedPost.date}
                                </span>
                            </div>

                            <h2 className="text-2xl md:text-3xl font-bold text-white mb-6 leading-tight">
                                {selectedPost.title[language] || selectedPost.title.EN}
                            </h2>

                            <div className="prose prose-invert prose-gold max-w-none">
                                <p className="text-gray-300 leading-relaxed text-lg whitespace-pre-line">
                                    {selectedPost.content[language] || selectedPost.content.EN}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </section>
    );
};

export default BlogSection;
