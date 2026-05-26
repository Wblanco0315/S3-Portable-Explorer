import { useMatches, Link } from "react-router-dom";
import { HiOutlineChevronRight } from "react-icons/hi";

export default function Breadcrumbs() {
  const matches = useMatches();

  // Filter matches to get those with a title in the handle
  const breadcrumbs = matches
    .filter((match) => (match.handle as any)?.title)
    .map((match) => ({
      title: (match.handle as any).title,
      path: match.pathname,
    }));

  if (breadcrumbs.length === 0) return null;

  return (
    <div className="flex items-center gap-2 text-md font-bold text-gray-400 dark:text-slate-500 bg-white dark:bg-slate-900 ">
      <ol className="flex items-center space-x-2">
        {breadcrumbs.map((crumb, index) => (
          <li key={crumb.path} className="flex items-center">
            {index > 0 && (
              <HiOutlineChevronRight className="w-4 h-4 mx-2 text-gray-400" />
            )}
            {index === breadcrumbs.length - 1 ? (
              <span className="text-gray-900 dark:text-slate-100 font-semibold">{crumb.title}</span>
            ) : (
              <Link
                to={crumb.path}
                className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
              >
                {crumb.title}
              </Link>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}
