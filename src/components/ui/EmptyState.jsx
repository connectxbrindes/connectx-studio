export default function EmptyState({ title, description }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 py-16 text-center">
      <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.5" stroke="currentColor" className="mb-2 h-12 w-12 text-text-secondary/40">
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 00-3 3h15.75m-12.75-3h11.218c1.121-2.3 1.994-4.694 2.602-7.163.087-.35-.173-.687-.533-.687H5.25M7.5 14.25L5.106 5.272" />
      </svg>
      <h3 className="text-lg font-semibold">{title}</h3>
      <p className="text-sm text-text-secondary">{description}</p>
    </div>
  );
}
