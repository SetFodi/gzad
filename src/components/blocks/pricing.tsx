"use client";

import { buttonVariants } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useMediaQuery } from "@/hooks/use-media-query";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { Check, Star, Calculator, Sliders } from "lucide-react";
import Link from "next/link";
import { useState, useRef, useEffect } from "react";
import confetti from "canvas-confetti";
import NumberFlow from "@number-flow/react";

interface PricingPlan {
    name: string;
    price: string;
    yearlyPrice: string;
    period: string;
    features: string[];
    description: string;
    buttonText: string;
    href: string;
    isPopular: boolean;
}

interface PricingProps {
    plans: PricingPlan[];
    title?: string;
    description?: string;
    calculatorLabels: {
        title: string;
        subtitle: string;
        durationLabel: string;
        hoursLabel: string;
        quantityLabel: string;
        total: string;
        perDay: string;
        displayUnit: string;
        totalHours: string;
        hoursUnit: string;
        daysUnit: string;
        dayUnit: string;
        displayLabel: string;
        displaysLabel: string;
        coverage: string;
        coverageValue: string;
        matchMessage: string;
        packageWord: string;
        requestQuote: string;
    };
    switchLabels: {
        standard: string;
        custom: string;
    };
}

export function Pricing({
    plans,
    title = "Simple, Transparent Pricing",
    description = "Choose the plan that works for you",
    calculatorLabels,
    switchLabels,
}: PricingProps) {
    const [isCustom, setIsCustom] = useState(false);
    const isDesktop = useMediaQuery("(min-width: 768px)");

    // Calculator State
    const [duration, setDuration] = useState(30); // Default to a month
    const [hoursPerDay, setHoursPerDay] = useState(1);
    const [quantity, setQuantity] = useState(1);

    // Package definitions for matching (the target fixed points)
    const packages = [
        { name: "სტარტი", nameEn: "Start", days: 30, hours: 1, displays: 1, price: 400 },
        { name: "ოპტიმალური", nameEn: "Optimal", days: 30, hours: 2, displays: 1, price: 800 },
        { name: "პრომო", nameEn: "Promo", days: 7, hours: 1, displays: 1, price: 100 }, // Fixed Package
    ];

    // Check if current selection matches a package exactly
    const matchedPackage = packages.find(
        pkg => pkg.days === duration && pkg.hours === hoursPerDay && pkg.displays === quantity
    );

    /**
     * DAILY PROPORTIONAL PRICING MODEL
     * Base Rate: ₾400 per 30 Days @ 1 Hour/Day @ 1 Display
     * Rate per Hour-Day: 400 / 30 = ₾13.3333
     */
    const calculateCustomPrice = () => {
        const totalUnits = duration * hoursPerDay * quantity;
        const ratePerUnit = 400 / 30;

        return Math.round(totalUnits * ratePerUnit);
    };

    const totalPrice = matchedPackage ? matchedPackage.price : calculateCustomPrice();
    const dailyPrice = Math.round(totalPrice / duration);

    const handleToggle = (checked: boolean) => {
        setIsCustom(checked);
    };


    return (
        <div className="mx-auto max-w-6xl px-6 py-20">
            <div className="text-center space-y-4 mb-12">
                <h2 className="text-4xl font-bold tracking-tight sm:text-5xl text-foreground">
                    {title}
                </h2>
                <p className="text-muted-foreground text-lg whitespace-pre-line">
                    {description}
                </p>
            </div>

            <div className="flex justify-center mb-16">
                <div className="bg-muted p-1 rounded-xl flex items-center border border-border">
                    <button
                        onClick={() => setIsCustom(false)}
                        className={cn(
                            "px-6 py-2 rounded-lg text-sm font-semibold transition-all duration-300",
                            !isCustom
                                ? "bg-primary text-primary-foreground shadow-md"
                                : "text-muted-foreground hover:text-foreground"
                        )}
                    >
                        {switchLabels?.standard || "Standard"}
                    </button>
                    <button
                        onClick={() => setIsCustom(true)}
                        className={cn(
                            "px-6 py-2 rounded-lg text-sm font-semibold transition-all duration-300 flex items-center gap-2",
                            isCustom
                                ? "bg-primary text-primary-foreground shadow-md"
                                : "text-muted-foreground hover:text-foreground"
                        )}
                    >
                        <Calculator className="w-4 h-4" />
                        {switchLabels?.custom || "Calculator"}
                    </button>
                </div>
            </div>

            <AnimatePresence mode="wait">
                {!isCustom ? (
                    <motion.div
                        key="standard"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        transition={{ duration: 0.3 }}
                        className="grid grid-cols-1 md:grid-cols-3 gap-6"
                    >
                        {plans.map((plan, index) => (
                            <motion.div
                                key={index}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: index * 0.1 }}
                                className={cn(
                                    `rounded-2xl border-[1px] p-8 bg-card text-center flex flex-col relative overflow-hidden group`,
                                    plan.isPopular ? "border-primary border-2 shadow-2xl shadow-primary/10" : "border-border hover:border-border/80",
                                )}
                            >
                                {plan.isPopular && (
                                    <div className="absolute top-0 right-0 bg-primary py-1 px-3 rounded-bl-xl flex items-center">
                                        <Star className="text-primary-foreground h-3.5 w-3.5 fill-current" />
                                        <span className="text-primary-foreground ml-1.5 text-xs font-bold uppercase tracking-wider">
                                            Popular
                                        </span>
                                    </div>
                                )}

                                <div className="mb-6">
                                    <h3 className="text-xl font-bold text-foreground mb-2">{plan.name}</h3>
                                    <p className="text-sm text-muted-foreground line-clamp-2 min-h-[40px]">{plan.description}</p>
                                </div>

                                <div className="mb-8 flex items-baseline justify-center gap-1">
                                    <span className="text-sm font-semibold text-muted-foreground relative -top-4">₾</span>
                                    <span className="text-5xl font-bold tracking-tight text-foreground">
                                        <NumberFlow
                                            value={Number(plan.price)}
                                            format={{ useGrouping: true }}
                                        />
                                    </span>
                                    <span className="text-sm text-muted-foreground font-medium">{plan.period}</span>
                                </div>

                                <ul className="space-y-4 mb-8 text-left flex-1">
                                    {plan.features.map((feature, idx) => (
                                        <li key={idx} className="flex items-start gap-3">
                                            <div className="mt-1 w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                                                <Check className="h-3 w-3 text-primary" />
                                            </div>
                                            <span className="text-sm text-card-foreground/90">{feature}</span>
                                        </li>
                                    ))}
                                </ul>

                                <Link
                                    href={plan.href}
                                    className={cn(
                                        buttonVariants({ variant: plan.isPopular ? "default" : "outline" }),
                                        "w-full py-6 text-base font-semibold",
                                        plan.isPopular ? "bg-primary text-primary-foreground hover:bg-primary/90" : "border-border hover:bg-muted"
                                    )}
                                >
                                    {plan.buttonText}
                                </Link>
                            </motion.div>
                        ))}
                    </motion.div>
                ) : (
                    <motion.div
                        key="custom"
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        transition={{ duration: 0.3 }}
                        className="max-w-4xl mx-auto"
                    >
                        <div className="grid md:grid-cols-2 gap-8 bg-card rounded-3xl border border-border p-8 md:p-12 shadow-2xl relative overflow-hidden">
                            <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />

                            {/* Controls */}
                            <div className="space-y-10 relative z-10">
                                <div>
                                    <h3 className="text-2xl font-bold mb-2 flex items-center gap-2">
                                        <Sliders className="w-5 h-5 text-primary" />
                                        {calculatorLabels?.title || "Custom Campaign"}
                                    </h3>
                                    <p className="text-muted-foreground">
                                        {calculatorLabels?.subtitle || "Adjust parameters to estimate your cost."}
                                    </p>
                                </div>

                                <div className="space-y-6">
                                    <div className="space-y-4">
                                        <div className="flex justify-between items-center">
                                            <label className="text-sm font-medium text-foreground">
                                                {calculatorLabels?.quantityLabel || "Number of Displays"}
                                            </label>
                                            <span className="text-primary font-bold bg-primary/10 px-3 py-1 rounded-lg">
                                                {quantity} {calculatorLabels?.displaysLabel || "Displays"}
                                            </span>
                                        </div>
                                        <input
                                            type="range"
                                            min="1"
                                            max="50"
                                            step="1"
                                            value={quantity}
                                            onChange={(e) => setQuantity(Number(e.target.value))}
                                            className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
                                        />
                                        <div className="flex justify-between text-xs text-muted-foreground px-1">
                                            <span>1 {calculatorLabels?.displayLabel || "Display"}</span>
                                            <span>50 {calculatorLabels?.displaysLabel || "Displays"}</span>
                                        </div>
                                    </div>

                                    <div className="space-y-4">
                                        <div className="flex justify-between items-center">
                                            <label className="text-sm font-medium text-foreground">
                                                {calculatorLabels?.durationLabel || "Duration (Days)"}
                                            </label>
                                            <span className="text-primary font-bold bg-primary/10 px-3 py-1 rounded-lg">
                                                {duration} {duration === 1 ? (calculatorLabels?.dayUnit || "Day") : (calculatorLabels?.daysUnit || "Days")}
                                            </span>
                                        </div>
                                        <input
                                            type="range"
                                            min="5"
                                            max="90"
                                            step="5"
                                            value={duration}
                                            onChange={(e) => setDuration(Number(e.target.value))}
                                            className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
                                        />
                                        <div className="flex justify-between text-xs text-muted-foreground px-1">
                                            <span>5 {calculatorLabels?.daysUnit || "Days"}</span>
                                            <span>90 {calculatorLabels?.daysUnit || "Days"}</span>
                                        </div>
                                    </div>

                                    <div className="space-y-4">
                                        <div className="flex justify-between items-center">
                                            <label className="text-sm font-medium text-foreground">
                                                {calculatorLabels?.hoursLabel || "Hours Daily"}
                                            </label>
                                            <span className="text-primary font-bold bg-primary/10 px-3 py-1 rounded-lg">
                                                {hoursPerDay} {calculatorLabels?.hoursUnit || "Hours"}
                                            </span>
                                        </div>
                                        <input
                                            type="range"
                                            min="1"
                                            max="24"
                                            step="1"
                                            value={hoursPerDay}
                                            onChange={(e) => setHoursPerDay(Number(e.target.value))}
                                            className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
                                        />
                                        <div className="flex justify-between text-xs text-muted-foreground px-1">
                                            <span>1 {calculatorLabels?.hoursUnit || "Hour"}</span>
                                            <span>24 {calculatorLabels?.hoursUnit || "Hours"}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Result Card */}
                            <div className="bg-muted/30 rounded-2xl p-8 border border-border/50 flex flex-col justify-between relative z-10">
                                <div>
                                    <h4 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-6">
                                        {calculatorLabels?.total || "Estimated Total"}
                                    </h4>
                                    <div className="flex items-baseline gap-1 mb-2">
                                        <span className="text-2xl text-muted-foreground">₾</span>
                                        <span className="text-6xl font-bold tracking-tighter text-foreground">
                                            <NumberFlow value={totalPrice} />
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-2 text-sm text-muted-foreground mb-8">
                                        <span>≈ ₾{dailyPrice} {calculatorLabels?.perDay || "per day"}</span>
                                    </div>

                                    <div className="space-y-3 mb-8">
                                        <div className="flex items-center justify-between text-sm py-2 border-b border-border/50">
                                            <span className="text-muted-foreground">{calculatorLabels?.displayLabel || "Display"}</span>
                                            <span className="font-medium">{quantity} x {calculatorLabels?.displayUnit || "P4 LED Screen"}</span>
                                        </div>
                                        <div className="flex items-center justify-between text-sm py-2 border-b border-border/50">
                                            <span className="text-muted-foreground">{calculatorLabels?.totalHours || "Total Hours"}</span>
                                            <span className="font-medium">{duration * hoursPerDay * quantity} {calculatorLabels?.hoursUnit || "Hours"}</span>
                                        </div>
                                        <div className="flex items-center justify-between text-sm py-2 border-b border-border/50">
                                            <span className="text-muted-foreground">{calculatorLabels?.coverage || "Coverage"}</span>
                                            <span className="font-medium">{calculatorLabels?.coverageValue || "Tbilisi City Center"}</span>
                                        </div>
                                    </div>
                                </div>

                                {matchedPackage && (
                                    <motion.div
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        className="mb-4"
                                    >
                                        <button
                                            onClick={() => setIsCustom(false)}
                                            className="w-full py-4 px-6 rounded-xl bg-gradient-to-r from-primary/20 to-primary/10 border-2 border-primary/50 text-primary font-semibold flex items-center justify-center gap-2 hover:from-primary/30 hover:to-primary/20 transition-all duration-300 animate-pulse"
                                        >
                                            <Star className="w-5 h-5 fill-current" />
                                            {calculatorLabels?.matchMessage || "This matches our"} "{matchedPackage.nameEn}" {calculatorLabels?.packageWord || "package"}!
                                        </button>
                                    </motion.div>
                                )}

                                <Link
                                    href={`mailto:gzadvertisment@gmail.com?subject=Custom Project Inquiry&body=I am interested in a custom package for ${quantity} displays, ${duration} days, ${hoursPerDay} hours per day.`}
                                    className={cn(
                                        buttonVariants({ variant: "default" }),
                                        "w-full py-6 text-base font-bold shadow-lg shadow-primary/20"
                                    )}
                                >
                                    {calculatorLabels?.requestQuote || "Request Quote"}
                                </Link>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
