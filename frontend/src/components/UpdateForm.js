'use client';

import { useState } from 'react';
import { toast } from 'react-toastify';
import { updateConfig } from '@/lib/api';

export default function UpdateForm({ tenantId, configId }) {
  const [path, setPath] = useState('');
  const [value, setValue] = useState('');
  const [dependencies, setDependencies] = useState('');
  const [userId, setUserId] = useState('User1');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!path.startsWith('/')) {
      toast.error('Path must start with /');
      return;
    }
    const deps = dependencies.split(',').map(d => d.trim()).filter(d => d);
    if (deps.some(dep => !dep.startsWith('/'))) {
      toast.error('Dependencies must start with /');
      return;
    }
    setIsLoading(true);
    try {
      await updateConfig(tenantId, configId, { path, value, dependencies: deps, userId });
      toast.success(`Updated ${path} by ${userId} for ${tenantId}:${configId}`);
      setPath('');
      setValue('');
      setDependencies('');
    } catch (err) {
      toast.error(`Update failed: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="userId" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          User ID (Demo: User1/User2 are placeholders, no functional difference)
        </label>
        <select
          id="userId"
          value={userId}
          onChange={(e) => setUserId(e.target.value)}
          className="mt-1 p-2 w-full border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100 transition-smooth"
        >
          <option value="User1">User1</option>
          <option value="User2">User2</option>
        </select>
      </div>
      <div>
        <label htmlFor="path" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          Node Path (e.g., /settings/theme/color)
        </label>
        <input
          id="path"
          value={path}
          onChange={(e) => setPath(e.target.value)}
          placeholder="/settings/theme/color"
          className="mt-1 p-2 w-full border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100 transition-smooth"
          required
        />
      </div>
      <div>
        <label htmlFor="value" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          Value (e.g., red)
        </label>
        <input
          id="value"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="red"
          className="mt-1 p-2 w-full border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100 transition-smooth"
          required
        />
      </div>
      <div>
        <label htmlFor="dependencies" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          Dependencies (comma-separated, e.g., /settings/theme/dark)
        </label>
        <input
          id="dependencies"
          value={dependencies}
          onChange={(e) => setDependencies(e.target.value)}
          placeholder="/settings/theme/dark"
          className="mt-1 p-2 w-full border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100 transition-smooth"
        />
      </div>
      <button
        type="submit"
        disabled={isLoading}
        className={`p-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 dark:bg-blue-600 dark:hover:bg-blue-700 transition-smooth ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
      >
        {isLoading ? 'Updating...' : 'Update Node'}
      </button>
    </form>
  );
}