# Programs
cat src/pages/Programs.tsx | grep -v 'export default Programs;' > src/pages/Programs.tsx.new
sed -i 's/import MainLayout from '"'"'..\/components\/layout\/MainLayout'"'"';/import MainLayout from '"'"'..\/components\/layout\/MainLayout'"'"';\nimport SEO from '"'"'..\/components\/ui\/SEO'"'"';/' src/pages/Programs.tsx.new
sed -i 's/<MainLayout>/<MainLayout>\n      <SEO title="Programs" description="Explore our ecosystem of educational and tech programs." \/>/' src/pages/Programs.tsx.new
echo "export default Programs;" >> src/pages/Programs.tsx.new
mv src/pages/Programs.tsx.new src/pages/Programs.tsx

# Services
cat src/pages/Services.tsx | grep -v 'export default Services;' > src/pages/Services.tsx.new
sed -i 's/import MainLayout from '"'"'..\/components\/layout\/MainLayout'"'"';/import MainLayout from '"'"'..\/components\/layout\/MainLayout'"'"';\nimport SEO from '"'"'..\/components\/ui\/SEO'"'"';/' src/pages/Services.tsx.new
sed -i 's/<MainLayout>/<MainLayout>\n      <SEO title="Services" description="Professional technology and creative services designed to elevate your brand." \/>/' src/pages/Services.tsx.new
echo "export default Services;" >> src/pages/Services.tsx.new
mv src/pages/Services.tsx.new src/pages/Services.tsx

# Portfolio
cat src/pages/Portfolio.tsx | grep -v 'export default Portfolio;' > src/pages/Portfolio.tsx.new
sed -i 's/import MainLayout from '"'"'..\/components\/layout\/MainLayout'"'"';/import MainLayout from '"'"'..\/components\/layout\/MainLayout'"'"';\nimport SEO from '"'"'..\/components\/ui\/SEO'"'"';/' src/pages/Portfolio.tsx.new
sed -i 's/<MainLayout>/<MainLayout>\n      <SEO title="Portfolio" description="Explore our recent projects and case studies." \/>/' src/pages/Portfolio.tsx.new
echo "export default Portfolio;" >> src/pages/Portfolio.tsx.new
mv src/pages/Portfolio.tsx.new src/pages/Portfolio.tsx

# Blog
cat src/pages/Blog.tsx | grep -v 'export default Blog;' > src/pages/Blog.tsx.new
sed -i 's/import MainLayout from '"'"'..\/components\/layout\/MainLayout'"'"';/import MainLayout from '"'"'..\/components\/layout\/MainLayout'"'"';\nimport SEO from '"'"'..\/components\/ui\/SEO'"'"';/' src/pages/Blog.tsx.new
sed -i 's/<MainLayout>/<MainLayout>\n      <SEO title="Blog" description="Insights, tutorials and tech news." \/>/' src/pages/Blog.tsx.new
echo "export default Blog;" >> src/pages/Blog.tsx.new
mv src/pages/Blog.tsx.new src/pages/Blog.tsx
